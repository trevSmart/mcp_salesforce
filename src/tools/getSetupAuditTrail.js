import {log, textFileContent, writeToTmpFile} from '../utils.js';
import {newResource} from '../mcp-server.js';
import {z} from 'zod';
import {retrieveSetupAuditTrailFile} from '../auditTrailDownloader.js';
import client from '../client.js';

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
			.describe('Name of the file or folder to get the changes of (e.g. "FOO_AlertMessages_Controller", "FOO_AlertMessage__c", "FOO_AlertNessageList_LWC", etc.)')
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Get the changes in the Salesforce org metadata performed in the last days from the Salesforce Setup Audit Trail data'
	}
};

export async function getSetupAuditTrailToolHandler({lastDays = 90, createdByName = null, metadataName = null}) {
	try {
		const fileName = 'SetupAuditTrail.csv';
		const resourceUri = `file://SetupAuditTrail/${fileName}`;

		log('Iniciant descàrrega del Setup Audit Trail...', 'debug');
		let fileContent = null;

		try {
			fileContent = await retrieveSetupAuditTrailFile();
			writeToTmpFile(fileContent, fileName);

		} catch (downloadError) {
			log(`Error en la descàrrega: ${downloadError.message}`, 'warn');
			throw downloadError;
		}

		if (!fileContent || fileContent.trim() === '') {
			throw new Error('No s\'ha pogut obtenir dades del Setup Audit Trail. El fitxer està buit.');
		}

		// Parsejar el CSV i convertir-lo a JSON
		const allData = parseCsvToJson(fileContent);

		// Filtrar les dades segons els paràmetres
		const filteredData = filterAuditTrailData(allData, lastDays, createdByName, metadataName);
		log(`Registres després del filtrat: ${filteredData.length}`, 'debug');

		newResource(
			resourceUri,
			'Setup audit trail CSV',
			'Setup audit trail CSV',
			'text/csv',
			fileContent,
			{audience: ['user', 'assistant']}
		);

		const content = [{
			type: 'text',
			text: `Setup audit trail CSV downloaded successfully. Found ${filteredData.length} records matching the criteria.`
		}];

		if (client.supportsCapability('resource_links')) {
			content.push({type: 'resource_link', uri: resourceUri});
		}

		return {
			content,
			structuredContent: {
				filters: {
					lastDays,
					createdByName,
					metadataName
				},
				count: filteredData.length,
				records: filteredData
			}
		};

	} catch (error) {
		log(error, 'error', 'Error getting setup audit trail data');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `Error retrieving Setup Audit Trail data:\n\nError message:\n${error.message}\n\nError stack:\n${error.stack}`
			}]
		};
	}
}

/**
 * Parseja el contingut CSV i el converteix a JSON
 */
function parseCsvToJson(csvContent) {
	const lines = csvContent.split('\n').filter(line => line.trim());

	if (lines.length === 0) {
		return [];
	}

	const headers = parseCsvLine(lines[0]).map(h => h.trim().replace(/"/g, ''));
	const jsonData = [];

	for (let i = 1; i < lines.length; i++) {
		if (!lines[i]?.trim()) {
			continue;
		}

		try {
			const values = parseCsvLine(lines[i]);
			const obj = {};

			for (let j = 0; j < headers.length; j++) {
				obj[headers[j]] = values[j] || '';
			}

			jsonData.push(obj);
		} catch (error) {
			log(`Error processant línia ${i}: ${error.message}`, 'error');
		}
	}

	return jsonData;
}

/**
 * Parseja una línia CSV tenint en compte les cometes
 */
function parseCsvLine(line) {
	if (!line || typeof line !== 'string') {
		return [];
	}

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

	values.push(currentValue.replace(/"/g, '').trim());
	return values;
}

/**
 * Parseja una data del format Salesforce (ex: "3/3/2025, 8:47:34 CET")
 */
function parseSalesforceDate(dateString) {
	if (!dateString || typeof dateString !== 'string') {
		return null;
	}

	try {
		// Primer intent: format estàndard ISO
		const isoDate = new Date(dateString);
		if (!isNaN(isoDate.getTime())) {
			return isoDate;
		}

		// Segon intent: format Salesforce "3/3/2025, 8:47:34 CET"
		const cleanDateString = dateString.replace(/,?\s*[A-Z]{3}$/, '').replace(',', '');

		const parts = cleanDateString.split(' ');
		if (parts.length >= 2) {
			const datePart = parts[0];
			const timePart = parts[1];

			const dateParts = datePart.split('/');
			if (dateParts.length === 3) {
				const month = parseInt(dateParts[0]) - 1;
				const day = parseInt(dateParts[1]);
				const year = parseInt(dateParts[2]);

				const timeParts = timePart.split(':');
				if (timeParts.length >= 2) {
					const hours = parseInt(timeParts[0]);
					const minutes = parseInt(timeParts[1]);
					const seconds = timeParts.length > 2 ? parseInt(timeParts[2]) : 0;

					const parsedDate = new Date(year, month, day, hours, minutes, seconds);
					if (!isNaN(parsedDate.getTime())) {
						return parsedDate;
					}
				}
			}
		}

		// Tercer intent: format més genèric
		const genericDate = new Date(cleanDateString);
		if (!isNaN(genericDate.getTime())) {
			return genericDate;
		}

		return null;
	} catch (error) {
		log(`Error parsejant data "${dateString}": ${error.message}`, 'debug');
		return null;
	}
}

/**
 * Filtra les dades de l'audit trail segons els paràmetres
 */
function filterAuditTrailData(data, lastDays, createdByName, metadataName) {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - lastDays);

	return data.filter(record => {
		// Filtrar per data
		const dateField = record.Date || record.CreatedDate || record.Timestamp;
		if (!dateField) {
			return false;
		}

		const recordDate = parseSalesforceDate(dateField);
		if (!recordDate || recordDate < cutoffDate) {
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

		return true;
	});
}
