import {log, textFileContent} from '../utils.js';
import {newResource} from '../mcp-server.js';
import {z} from 'zod';
import {retrieveSetupAuditTrailFile} from '../auditTrailDownloader.js';
import client from '../client.js';
import fs from 'fs';
import path from 'path';

export const getSetupAuditTrailToolDefinition = {
	name: 'getSetupAuditTrail',
	title: 'Get the changes in the Salesforce org metadata performed in the last days from the Salesforce Setup Audit Trail data, filtered by allowed sections',
	description: textFileContent('getSetupAuditTrail'),
	inputSchema: {
		lastDays: z.number()
			.int()
			.min(1)
			.max(60)
			.optional()
			.default(30)
			.describe('Number of days to query (between 1 and 90)'),
		username: z.string()
			.optional()
			.describe('Only the changes performed by this username will be returned, if not set the changes from all users will be returned (example: "some.username@my.salesforce.org.com")'),
		metadataName: z.string()
			.optional()
			.describe('Name of the file or folder to get the changes of (e.g. "FOO_AlertMessages_Controller", "FOO_AlertMessage__c", "FOO_AlertNessageList_LWC", etc.)')
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Get the changes in the Salesforce org metadata performed in the last days from the Salesforce Setup Audit Trail data, filtered by allowed sections'
	}
};

/**
 * Seccions permeses per l'audit trail (només modificacions rellevants)
 */
const ALLOWED_SECTIONS = [
	'Apex Class',
	'Lightning Components',
	'Lightning Pages',
	'Groups',
	'Custom Objects',
	'Sharing Rules',
	'Customize Cases',
	'Customize Entitlement Process',
	'Named Credentials',
	'Customize Activities',
	'Custom Apps',
	'Apex Trigger',
	'Rename Tabs and Labels',
	'Custom Tabs',
	'Custom Metadata Types',
	'Validation Rules',
	'Static Resource',
	'Data Management',
	'Field Dependencies',
	'Customize Opportunities',
	'Omni-Channel',
	'Application',
	'Global Value Sets',
	'Triggers Settings',
	'External Credentials',
	'Custom Permissions',
	'Customize Accounts',
	'Customize Contacts',
	'Standard Buttons and Links',
	'Flows',
	'Workflow Rule',
	'Manage apps',
	'Sharing Defaults',
	'Connected Apps',
	'Customize Chat Transcripts',
	'Global Actions',
	'Customize Content',
	'Timeline Configurations [bmpyrckt]',
	'Page',
	'User Interface',
	'Component',
	'Customize Leads',
	'Customize Contracts'
];

/**
 * Normalitza el fitxer CSV convertint registres multi-línia en registres d'una sola línia
 */
function normalizeCSVFile(inputPath) {
	try {
		const data = fs.readFileSync(inputPath, 'utf8');
		const lines = data.split('\n');
		const normalizedLines = [];
		let currentRecord = null;

		// Regex per detectar l'inici d'un nou registre (data entre cometes)
		const newRecordRegex = /^"\d{1,2}\/\d{1,2}\/\d{4},/;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (i === 0) {
				// Primera línia: sempre és la capçalera
				normalizedLines.push(line.trim());
				continue;
			}

			if (newRecordRegex.test(line)) {
				// És un nou registre
				if (currentRecord) { normalizedLines.push(currentRecord); }
				currentRecord = line.trim();
			} else {
				// Continuació del registre anterior, eliminar salt de línia
				if (currentRecord) {
					currentRecord += ' ' + line.trim().replace(/\n/g, ' ');
				}
			}
		}

		if (currentRecord) { normalizedLines.push(currentRecord); }

		// Crear fitxer normalitzat en el mateix directori
		const dir = path.dirname(inputPath);
		const normalizedPath = path.join(dir, 'SetupAuditTrail-Normalized.csv');
		fs.writeFileSync(normalizedPath, normalizedLines.join('\n'));

		log(`CSV normalized: ${lines.length} → ${normalizedLines.length} lines`, 'debug');
		return normalizedPath;

	} catch (error) {
		log(`Error normalizing CSV: ${error.message}`, 'error');
		throw error;
	}
}

/**
 * Parseja una línia CSV tenint en compte les cometes
 */
function parseCSVLine(line) {
	if (!line || typeof line !== 'string') {
		return [];
	}

	const fields = [];
	let inQuotes = false;
	let currentField = '';
	let i = 0;

	while (i < line.length) {
		const char = line[i];

		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				// Cometes escapades
				currentField += '"';
				i += 2;
			} else {
				// Cometa d'obertura/tancament
				inQuotes = !inQuotes;
				i++;
			}
		} else if (char === ',' && !inQuotes) {
			// Separador de camp
			fields.push(currentField.trim());
			currentField = '';
			i++;
		} else {
			// Caràcter normal
			currentField += char;
			i++;
		}
	}

	// Afegir l'últim camp
	fields.push(currentField.trim());
	return fields;
}







/**
 * Comprova si un text conté una paraula exacta (no parcial)
 * Utilitza boundaries de paraula per evitar falsos positius
 */
function containsExactWord(text, word) {
	if (!text || !word) {
		return false;
	}

	// Crear un regex que busqui la paraula exacta amb boundaries de paraula
	// \b assegura que la paraula està delimitada per caràcters no-alfanumèrics
	const wordBoundaryRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

	return wordBoundaryRegex.test(text);
}

/**
 * Aplica tots els filtres en memòria i crea només el fitxer final
 */
function applyAllFilters(inputPath, lastDays, username, metadataName) {
	try {
		const data = fs.readFileSync(inputPath, 'utf8');
		const lines = data.split('\n');
		const filteredLines = [];
		let totalRecords = 0;
		let finalFilteredRecords = 0;

		// Calcular la data de tall
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - lastDays);
		cutoffDate.setHours(0, 0, 0, 0);

		log(`Applying all filters: last ${lastDays} days, user: ${username || 'all'}, metadata: ${metadataName || 'all'}`, 'debug');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (i === 0) {
				// Primera línia: sempre és la capçalera
				filteredLines.push(line.trim());
				continue;
			}

			if (!line.trim()) { continue; } // Saltar línies buides

			// Parsejar la línia CSV per obtenir tots els camps necessaris
			const fields = parseCSVLine(line);
			if (!fields || fields.length < 5) { continue; }

			const recordDate = parseSalesforceDate(fields[0]);
			const recordUser = fields[1];
			const recordSection = fields[4];
			const recordAction = fields[3];

			// Aplicar filtre de secció
			if (!ALLOWED_SECTIONS.includes(recordSection)) {
				continue;
			}

			// Aplicar filtre de data
			if (recordDate && recordDate < cutoffDate) {
				continue;
			}

			// Aplicar filtre d'usuari (si s'especifica)
			if (username && recordUser !== username) {
				continue;
			}

			// Aplicar filtre de metadata name (si s'especifica)
			if (metadataName && !containsExactWord(recordAction, metadataName)) {
				continue;
			}

			// Si arriba aquí, el registre passa tots els filtres
			filteredLines.push(line.trim());
			finalFilteredRecords++;
			totalRecords++;
		}

		// Crear només el fitxer final amb tots els filtres aplicats
		const dir = path.dirname(inputPath);
		const finalFilteredPath = path.join(dir, 'SetupAuditTrail-Final.csv');
		fs.writeFileSync(finalFilteredPath, filteredLines.join('\n'));

		log(`All filters applied: ${totalRecords} → ${finalFilteredRecords} records`, 'debug');
		return {finalFilteredPath, totalRecords, finalFilteredRecords};

	} catch (error) {
		log(`Error applying all filters: ${error.message}`, 'error');
		throw error;
	}
}

/**
 * Converteix el contingut CSV en un array d'objectes amb els canvis
 */
function parseCSVToRecords(csvContent) {
	if (!csvContent) {
		return [];
	}

	const lines = csvContent.split('\n');
	const records = [];

	// Saltar la primera línia (capçalera)
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) { continue; } // Saltar línies buides

		try {
			const fields = parseCSVLine(line);
			if (fields && fields.length >= 5) {
				const record = {
					date: fields[0],
					user: fields[1],
					section: fields[4],
					action: fields[3]
				};
				records.push(record);
			}
		} catch (error) {
			log(`Error parsing CSV line ${i}: ${error.message}`, 'debug');
			continue;
		}
	}

	return records;
}

/**
 * Parseja una data del format Salesforce (ex: "12/8/2025, 11:54:14 CEST")
 */
function parseSalesforceDate(dateString) {
	if (!dateString || typeof dateString !== 'string') {
		return null;
	}

	try {
		// Primer intent: format europeu D/M/YYYY (corregit)
		const euDateMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
		if (euDateMatch) {
			const day = parseInt(euDateMatch[1]);
			const month = parseInt(euDateMatch[2]) - 1; // Els mesos van de 0 a 11
			const year = parseInt(euDateMatch[3]);
			return new Date(year, month, day);
		}

		// Segon intent: format estàndard ISO
		const isoDate = new Date(dateString);
		if (!isNaN(isoDate.getTime())) {
			return isoDate;
		}

		// Tercer intent: format més genèric
		const genericDate = new Date(dateString);
		if (!isNaN(genericDate.getTime())) {
			return genericDate;
		}

		return null;
	} catch (error) {
		log(`Error parsing date "${dateString}": ${error.message}`, 'debug');
		return null;
	}
}

export async function getSetupAuditTrailToolHandler({lastDays = 30, username = null, metadataName = null}) {
	try {
		const fileName = 'SetupAuditTrail.csv';
		const resourceUri = `file://SetupAuditTrail/${fileName}`;

		// Check if the resource already exists
		let filePath = null;
		let originalFileContent = null;

		try {
			// Try to get the resource from the MCP server first
			const existingResource = await client.getResource(resourceUri);
			if (existingResource) {
				log('Resource already exists, using existing CSV data', 'debug');
				originalFileContent = existingResource.content;
				// Create a temporary file with the resource content for processing
				const tmpDir = path.dirname(process.cwd());
				filePath = path.join(tmpDir, 'SetupAuditTrail-FromResource.csv');
				fs.writeFileSync(filePath, originalFileContent);
			}
		} catch {
			log('Resource not found, will download file', 'debug');
		}

		// If resource doesn't exist, download the file
		if (!filePath || !fs.existsSync(filePath)) {
			log('Starting Setup Audit Trail file download...', 'debug');
			try {
				filePath = await retrieveSetupAuditTrailFile();
			} catch (downloadError) {
				log(`Setup Audit Trail file download error: ${downloadError.message}`, 'error');
				throw downloadError;
			}

			if (!filePath || !fs.existsSync(filePath)) {
				throw new Error('Could not retrieve Setup Audit Trail data. The file was not downloaded.');
			}
		}

		// Step 1: Normalize the CSV file (convert multi-line records to single-line)
		log('Normalizing CSV file...', 'debug');
		const normalizedFilePath = normalizeCSVFile(filePath);

		// Step 2: Apply all filters in memory and create only the final filtered file
		log('Applying all filters...', 'debug');
		const {finalFilteredPath, totalRecords, finalFilteredRecords} = applyAllFilters(normalizedFilePath, lastDays, username, metadataName);



		// Read original file content for the resource (unfiltered) if not already loaded
		if (!originalFileContent) {
			originalFileContent = fs.readFileSync(filePath, 'utf8');
		}

		// Read filtered file content and parse it into records
		const filteredFileContent = fs.readFileSync(finalFilteredPath, 'utf8');
		const records = parseCSVToRecords(filteredFileContent);

		newResource(
			resourceUri,
			'Setup audit trail CSV (original)',
			'Setup audit trail CSV with all records (unfiltered)',
			'text/csv',
			originalFileContent,
			{audience: ['user', 'assistant']}
		);

		const content = [{
			type: 'text',
			text: `Setup audit trail CSV processed successfully. Total records: ${totalRecords}, Filtered records: ${finalFilteredRecords}`
		}];

		if (client.supportsCapability('resource_links')) {
			content.push({type: 'resource_link', uri: resourceUri});
		}

		return {
			content,
			structuredContent: {
				filters: {
					lastDays,
					username,
					metadataName
				},
				setupAuditTrailFileTotalRecords: totalRecords,
				setupAuditTrailFileFilteredTotalRecords: finalFilteredRecords,
				records: records
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
