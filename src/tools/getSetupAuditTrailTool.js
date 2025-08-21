import {log, textFileContent, getTimestamp} from '../utils.js';
import {newResource, resources} from '../mcp-server.js';
import fs from 'fs/promises';
import path from 'path';
import {z} from 'zod';
import state from '../state.js';
import client from '../client.js';
import {retrieveSetupAuditTrailFile} from '../auditTrailDownloader.js';

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

		// Utilitzar auditTrailDownloader.js per obtenir el contingut del CSV
		const fileContent = await retrieveSetupAuditTrailFile();
		log('Contingut CSV obtingut correctament', 'info');

		// Crear el directori tmp si no existeix
		const tmpDir = path.join(state.workspacePath, 'tmp');
		await fs.mkdir(tmpDir, {recursive: true});

		// Guardar el contingut del CSV a un fitxer al directori tmp
		const fileName = `setupAuditTrail_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
		const csvFilePath = path.join(tmpDir, fileName);
		await fs.writeFile(csvFilePath, fileContent, 'utf8');

		log(`CSV guardat a: ${csvFilePath}`, 'info');

		// Convertir CSV a JSON sense processar
		const structuredContent = csvToJson(fileContent);

		// Try to save to tmp directory if workspace path is available
		if (state.workspacePath) {
			const fullPath = path.join(tmpDir, fileName);
			try {
				await fs.writeFile(fullPath, JSON.stringify(structuredContent, null, 2), 'utf8');
				log(`JSON guardat a: ${fullPath}`, 'debug');
			} catch (err) {
				log(`Failed to write JSON to ${tmpDir}: ${err.message}`, 'error');
			}
		}

		// Cache the result for future use
		const cacheResource = newResource(
			resourceName,
			`Setup Audit Trail (${lastDays} days, ${createdByName || 'all users'}, ${metadataName || 'all metadata'})`,
			'Setup Audit Trail cached query results',
			'application/json',
			JSON.stringify(structuredContent, null, 2),
			{audience: ['assistant', 'user']}
		);

		const content = [{
			type: 'text',
			text: `Successfully retrieved setup audit trail data for the last ${lastDays} days.`
		}];

		if (client.supportsCapability('embeddedResources')) {
			const resource = newResource(
				`file://setup-audit-trail/${fileName}`,
				fileName,
				'Setup audit trail history',
				'text/csv',
				fileContent,
				{audience: ['user', 'assistant']}
			);
			content.push({type: 'resource', resource});
		}

		return {content, structuredContent};

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

/**
 * Converteix CSV a JSON sense processament addicional
 */
function csvToJson(csvContent) {
	const lines = csvContent.split('\n').filter(line => line.trim());
	if (lines.length === 0) {
		return [];
	}

	const headers = parseCsvLine(lines[0]).map(h => h.trim().replace(/"/g, ''));
	const jsonData = [];

	for (let i = 1; i < lines.length; i++) {
		if (!lines[i]?.trim()) { continue; }

		const values = parseCsvLine(lines[i]);
		const obj = {};

		for (let j = 0; j < headers.length; j++) {
			obj[headers[j]] = values[j] || '';
		}

		jsonData.push(obj);
	}

	return jsonData;
}

/**
 * Parseja una línia CSV tenint en compte les cometes
 */
function parseCsvLine(line) {
	const values = [];
	let inQuotes = false;
	let currentValue = '';

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			values.push(currentValue.replace(/"/g, '').trim());
			currentValue = '';
		} else {
			currentValue += char;
		}
	}

	// Afegir l'últim valor
	values.push(currentValue.replace(/"/g, '').trim());

	return values;
}