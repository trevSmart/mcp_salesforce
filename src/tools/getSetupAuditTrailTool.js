import {executeSoqlQuery} from '../salesforceServices.js';
import {log, textFileContent} from '../utils.js';
import {z} from 'zod';

const SOQL_LIMIT = 1000;

export const getSetupAuditTrailToolDefinition = {
	name: 'getSetupAuditTrail',
	title: 'Get the changes in the Salesforce org metadata performed in the last days from the Salesforce Setup Audit Trail data',
	description: textFileContent('getSetupAuditTrailTool'),
	inputSchema: {
		lastDays: z
			.number()
			.describe('Number of days to query (between 1 and 90)'),
		createdByName: z
			.string()
			.nullable()
			.describe('Only the changes performed by this user will be returned (null to return changes from all users)'),
		metadataName: z
			.string()
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

export async function getSetupAuditTrailTool({lastDays, createdByName, metadataName}) {
	try {
		if (!lastDays) {
			throw new Error('Last days is required');
		}

		let soqlQuery = 'SELECT Section, CreatedDate, CreatedBy.Name, Display FROM SetupAuditTrail';
		let shouldFilterByMetadataName = metadataName && metadataName.trim() !== '';
		let conditions = ['CreatedById != NULL'];

		if (lastDays) {
			conditions.push(`CreatedDate >= LAST_N_DAYS:${lastDays}`);
		}
		if (createdByName) {
			conditions.push(`CreatedBy.Name = '${createdByName.replace(/'/g, '\\\'')}'`);
		}
		if (conditions.length) {
			soqlQuery += ' WHERE ' + conditions.join(' AND ');
		}
		if (metadataName) {
			soqlQuery += ` AND Display LIKE '%${metadataName}%'`;
		}
		soqlQuery += ` ORDER BY CreatedDate DESC LIMIT ${SOQL_LIMIT}`;

		//Clean the query by replacing line breaks and tabs with spaces
		const cleanQuery = soqlQuery.replace(/[\n\t\r]+/g, ' ').trim();

		const response = await executeSoqlQuery(cleanQuery);

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
		const sizeBeforeFilters = response.records.length;
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

			const userName = record.CreatedBy && record.CreatedBy.Name ? record.CreatedBy.Name : 'Unknown User';
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
			sizeBeforeFilters,
			sizeAfterFilters: results.length,
			records: transformedResults
		};

		if (sizeBeforeFilters === SOQL_LIMIT) {
			formattedResult.warning = `The number of query results is equal to the set limit (${SOQL_LIMIT}), so there might be additional records that were not returned.`;
		}

		return {
			content: [{
				type: 'text',
				text: `✅ Setup audit trail history: ${JSON.stringify(formattedResult, null, '\t')}`
			}],
			structuredContent: formattedResult
		};

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