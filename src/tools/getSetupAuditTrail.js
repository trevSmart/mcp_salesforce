import {log, textFileContent} from '../utils.js';
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
	description: textFileContent('getSetupAuditTrail'),
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
			.describe('Name of the file or folder to get the changes of (e.g. "FOO_AlertMessages_Controller", "FOO_AlertMessage__c", "FOO_AlertNessageList_LWC", etc.)'),
		downloadCsv: z.boolean()
			.optional()
			.default(false)
			.describe('If true, returns the raw CSV file for download instead of the processed data')
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Get the changes in the Salesforce org metadata performed in the last days from the Salesforce Setup Audit Trail data'
	}
};

export async function getSetupAuditTrailToolHandler({lastDays = 90, createdByName = null, metadataName = null, downloadCsv = false}) {
	try {
		// Si l'usuari vol descarregar el CSV directament, no utilitzem la caché
		if (!downloadCsv) {
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

		// Si l'usuari ha demanat només el CSV, retornem el fitxer directament
		if (downloadCsv) {
			const content = [{
				type: 'text',
				text: `Setup audit trail CSV downloaded successfully. File saved to: ${csvFilePath}`
			}];

			if (client.supportsCapability('embeddedResources')) {
				const resource = newResource(
					`file://setup-audit-trail/${fileName}`,
					fileName,
					'Setup audit trail CSV',
					'text/csv',
					fileContent,
					{audience: ['user', 'assistant']}
				);
				content.push({type: 'resource', resource});
			}

			return {
				content,
				structuredContent: {
					csvFilePath,
					fileName
				}
			};
		}

		// Convertir CSV a JSON i processar les dades
		const allData = csvToJson(fileContent);

		// Filtrar les dades segons els paràmetres
		const filteredData = filterAuditTrailData(allData, lastDays, createdByName, metadataName);

		// Crear el contingut estructurat per a la resposta
		const structuredContent = {
			records: groupByUser(filteredData),
			totalRecords: filteredData.length,
			filteredBy: {
				lastDays,
				createdByName,
				metadataName
			}
		};

		// Guardar el JSON processat
		const jsonFileName = fileName.replace('.csv', '.json');
		const jsonFilePath = path.join(tmpDir, jsonFileName);
		try {
			await fs.writeFile(jsonFilePath, JSON.stringify(structuredContent, null, 2), 'utf8');
			log(`JSON processat guardat a: ${jsonFilePath}`, 'debug');
		} catch (err) {
			log(`Failed to write JSON to ${tmpDir}: ${err.message}`, 'error');
		}

		// Crear el recurs per a la cache
		if (client.supportsCapability('embeddedResources')) {
			const cacheResourceName = `mcp://mcp/setup-audit-trail-${lastDays}-${createdByName || 'all'}-${metadataName || 'all'}.json`;
			resources[cacheResourceName] = newResource(
				cacheResourceName,
				`setup-audit-trail-${lastDays}-${createdByName || 'all'}-${metadataName || 'all'}`,
				'Setup audit trail history',
				'application/json',
				JSON.stringify(structuredContent),
				{audience: ['user', 'assistant']}
			);
		}

		const content = [{
			type: 'text',
			text: `Successfully retrieved setup audit trail data for the last ${lastDays} days. Found ${filteredData.length} records.`
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

/**
 * Filtra les dades de l'audit trail segons els paràmetres
 */
function filterAuditTrailData(data, lastDays, createdByName, metadataName) {
	// Llista d'accions interessants; només conservem aquests registres
	const interestingActions = new Set([
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
	]);

	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - lastDays);

	return data.filter(record => {
		// Filtrar per data
		const recordDate = new Date(record.Date || record.CreatedDate || record.Timestamp);
		if (recordDate < cutoffDate) {
			return false;
		}

		// Filtrar per usuari
		if (createdByName && record.CreatedBy && !record.CreatedBy.includes(createdByName)) {
			return false;
		}

		// Filtrar per nom de metadata
		if (metadataName && record.Metadata && !record.Metadata.includes(metadataName)) {
			return false;
		}

		// Filtrar per acció interessant
		const actionName = record.Action || record.Change || '';
		if (!interestingActions.has(actionName)) {
			return false;
		}

		return true;
	});
}

/**
 * Agrupa les dades per usuari per a la resposta estructurada
 */
function groupByUser(data) {
	const grouped = {};

	data.forEach(record => {
		const userName = record.CreatedBy || record.User || 'Unknown User';
		if (!grouped[userName]) {
			grouped[userName] = [];
		}

		// Crear la descripció del canvi
		const changeDescription = `${record.Date || record.CreatedDate || record.Timestamp} - ${record.Metadata || record.Object || 'Unknown'} - ${record.Action || record.Change || 'Changed'}`;
		grouped[userName].push(changeDescription);
	});

	return grouped;
}