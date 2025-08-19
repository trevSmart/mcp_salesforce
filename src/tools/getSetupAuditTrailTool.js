import {executeSoqlQuery} from '../salesforceServices.js';
import {log, textFileContent, getTimestamp} from '../utils.js';
import {newResource, resources} from '../mcp-server.js';
import fs from 'fs/promises';
import path from 'path';
import {z} from 'zod';
import state from '../state.js';
import client from '../client.js';

export const getSetupAuditTrailToolDefinition = {
	name: 'getSetupAuditTrail',
	title: 'Get the changes in the Salesforce org metadata performed in the last days from the Salesforce Setup Audit Trail data',
	description: textFileContent('getSetupAuditTrailTool'),
	inputSchema: {
		lastDays: z.number()
			.int()
			.max(90)
			.optional()
			.describe('Number of days to query (between 1 and 90)'),
		createdByName: z.string()
			.nullable()
			.optional()
			.describe('Only the changes performed by this user will be returned (if not set, the changes from all users will be returned)'),
		metadataName: z.string()
			.nullable()
			.optional()
			.describe('Name of the file or folder to get the changes of (e.g. "FOO_AlertMessages_Controller", "FOO_AlertMessage__c", "FOO_AlertNessageList_LWC", etc.)')
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Get the changes in the Salesforce org metadata performed in the last days from the Salesforce Setup Audit Trail data'
	}
};

export async function getSetupAuditTrailTool({lastDays = 90, createdByName = null, metadataName = null}) {
	try {
		// Generate unique resource name based on parameters
		const resourceName = `mcp://mcp/setup-audit-trail-${lastDays}-${createdByName || 'all'}-${metadataName || 'all'}.json`;

		// Check if already cached
		if (resources[resourceName]) {
			log('Setup Audit Trail already cached, skipping fetch', 'debug');
			const cachedResult = JSON.parse(resources[resourceName].text);

			const content = [{
				type: 'text',
				text: `Display this data in a Markdown table with "Date", "User" and "Change description" columns, sorted by date in descending order: ${JSON.stringify(cachedResult, null, 3)}`
			}];

			if (client.supportsCapability('embeddedResources')) {
				// Reuse the existing cached resource instead of creating a new one
				content.push({type: 'resource', resource: resources[resourceName]});
			}

			return {
				content,
				structuredContent: {wasCached: true, ...cachedResult}
			};
		}

		const soqlQuery = buildSoqlQuery(lastDays, createdByName);
		const response = await executeSoqlQuery(soqlQuery);

		if (!response || !Array.isArray(response.records)) {
			throw new Error('No response or invalid response from Salesforce CLI');
		}

		//Validate and transform each record
		const validRecords = response.records.map(record => {
			if (record && typeof record === 'object'
				&& record.Section
				&& record.CreatedDate
				&& record.CreatedBy
				&& record.CreatedBy.Name) {
				return record;
			}
		}).filter(record => record !== null);

		const ignoredSections = [
			'Manage Users', 'Customize Activities', 'Connected App Session Policy',
			'Translation Workbench', 'CBK Configs', 'Security Controls'
		];

		let shouldFilterByMetadataName = metadataName && metadataName.trim() !== '';

		let results = validRecords.filter(r => {
			if (!r || typeof r !== 'object'
			|| !r.Section || ignoredSections.includes(r.Section)
			|| shouldFilterByMetadataName && r.Display && !r.Display.toLowerCase().includes(metadataName.toLowerCase())
			) {
				return false;
			}
			return true;
		});

		const transformedResults = results.reduce((acc, record) => {
			if (!record || typeof record !== 'object') {
				return acc;
			}

			const userName = record.CreatedBy.Name || 'Unknown';
			if (!acc[userName]) {
				acc[userName] = [];
			}

			const d = new Date(record.CreatedDate);
			if (isNaN(d.getTime())) {
				return acc;
			}

			const day = d.getDate().toString().padStart(2, '0');
			const month = (d.getMonth() + 1).toString().padStart(2, '0');
			const year = d.getFullYear().toString().slice(-2);
			const hour = d.getHours().toString().padStart(2, '0');
			const minute = d.getMinutes().toString().padStart(2, '0');

			let section = (record.Section || '').replace(/Apex Class/g, 'Apex');
			let display = (record.Display || '').replace(/Lightning Web Component/g, 'LWC');
			display = display.replace(/Aura Component/g, 'Aura');

			acc[userName].push(`${day}/${month}/${year} ${hour}:${minute} - ${section} - ${display}`);

			return acc;
		}, {});

		let formattedResult = {
			records: transformedResults
		};

		const formattedResultString = JSON.stringify(formattedResult, null, 3);


		// Try to save to tmp directory if workspace path is available
		if (state.workspacePath) {
			const tmpDir = path.join(state.workspacePath, 'tmp');
			const fileName = `SetupAuditTrail_${getTimestamp()}.json`;
			const fullPath = path.join(tmpDir, fileName);
			try {
				// Ensure tmp directory exists
				await fs.mkdir(tmpDir, {recursive: true});
				await fs.writeFile(fullPath, formattedResultString, 'utf8');
			} catch (err) {
				log(`Failed to write formattedResult to ${tmpDir}: ${err.message}`, 'error');
			}
		}

		const content = [{
			type: 'text',
			text: `Display this data in a Markdown table with "Date", "User" and "Change description" columns, sorted by date in descending order: ${formattedResultString}`
		}];

		// Cache the result for future use
		// eslint-disable-next-line no-unused-vars
		const cacheResource = newResource(
			resourceName,
			`Setup Audit Trail (${lastDays} days, ${createdByName || 'all users'}, ${metadataName || 'all metadata'})`,
			'Setup Audit Trail cached query results',
			'application/json',
			formattedResultString,
			{audience: ['assistant', 'user']}
		);

		if (client.supportsCapability('embeddedResources')) {
			const resource = newResource(
				`file://setup-audit-trail/${fileName}`,
				fileName,
				'Setup audit trail history',
				'application/json',
				formattedResultString,
				{audience: ['user', 'assistant']}
			);
			content.push({type: 'resource', resource});
		}

		return {content, structuredContent: formattedResult};

	} catch (error) {
		log(error, 'error');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `Error: ${error.message}`
			}]
		};
	}
}

function buildSoqlQuery(lastDays = 90, createdByName = null) {
	let soqlQuery = 'SELECT FORMAT (CreatedDate), Section, CreatedBy.Name, Display FROM SetupAuditTrail';
	const actions = [
		'changedActionOverrideContent', 'filteredLookupEdit', 'createdRecordTypeCustom', 'createdQuickAction',
		'changedQuickActionLayoutGlobal', 'createdApexPage', 'changedPicklistSortCustom', 'createServicePresenceStatus',
		'changedQuickActionNameCustom', 'deletedQuickActionCustom', 'CustomPermissionCreate', 'deletedApexComponent',
		'createdqueue', 'createdgroup', 'PermissionSetGroupCreate', 'changedStaticResource', 'deletedStaticResource',
		'createdCustMdType', 'filteredLookupRequired', 'filteredLookupCreate', 'deleteSharingRule', 'changedApexTrigger',
		'deletedAuraComponent', 'updateSharingRule', 'changedPicklist', 'changedPicklistCustom', 'changedRecordTypeName',
		'changedValidationFormula', 'deletedLightningWebComponent', 'createdAuraComponent', 'deletedQuickAction',
		'changedQuickActionLayout', 'deletedprofile', 'changedPicklistValueApiNameCustom', 'createdLightningWebComponent',
		'deletedApexPage', 'deletedApexClass', 'PermSetCreate', 'changedApexPage', 'caselayout', 'createduser',
		'queueMembership', 'groupMembership', 'createdApexClass', 'PermSetDelete', 'profilePageLayoutChangedCustom',
		'PermSetRecordTypeRemoved', 'PermSetAssign', 'PermSetUnassign', 'changedFlexiPage', 'PermSetRecordTypeAdded',
		'changedAuraComponent', 'PermSetFlsChanged', 'changedApexClass', 'changedLightningWebComponent'
	];
	let conditions = ['Action IN (' + actions.map(a => `'${a}'`).join(',') + ')'];
	lastDays && conditions.push(`CreatedDate = LAST_N_DAYS:${lastDays}`);
	createdByName && conditions.push(`CreatedBy.Name = '${createdByName.replace(/'/g, '\\\'')}'`);
	soqlQuery += ' WHERE ' + conditions.join(' AND ') + ' ORDER BY CreatedDate DESC';

	return soqlQuery.replace(/[\n\t\r]+/g, ' ').trim();
}