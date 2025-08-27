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
 * Filtra el fitxer CSV per mantenir només les seccions rellevants
 */
function filterCSVBySections(inputPath) {
	try {
		const data = fs.readFileSync(inputPath, 'utf8');
		const lines = data.split('\n');
		const filteredLines = [];
		let totalRecords = 0;
		let filteredRecords = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (i === 0) {
				// Primera línia: sempre és la capçalera
				filteredLines.push(line.trim());
				continue;
			}

			if (!line.trim()) { continue; } // Saltar línies buides

			// Parsejar la línia CSV per obtenir el camp Section
			const section = extractSectionFromCSVLine(line);

			if (section && ALLOWED_SECTIONS.includes(section)) {
				filteredLines.push(line.trim());
				filteredRecords++;
			}

			totalRecords++;
		}

		// Crear fitxer filtrat en el mateix directori
		const dir = path.dirname(inputPath);
		const filteredPath = path.join(dir, 'SetupAuditTrail-Filtered.csv');
		fs.writeFileSync(filteredPath, filteredLines.join('\n'));

		log(`CSV filtered by sections: ${totalRecords} → ${filteredRecords} records`, 'debug');
		return {filteredPath, totalRecords, filteredRecords};

	} catch (error) {
		log(`Error filtering CSV by sections: ${error.message}`, 'error');
		throw error;
	}
}

/**
 * Filtra el fitxer CSV per data (últims X dies)
 * Com que el fitxer està ordenat per data descendentment, podem aturar-nos quan trobem el primer registre fora del rang
 */
function filterCSVByDate(inputPath, lastDays) {
	try {
		const data = fs.readFileSync(inputPath, 'utf8');
		const lines = data.split('\n');
		const filteredLines = [];
		let totalRecords = 0;
		let filteredRecords = 0;

		// Calcular la data de tall incloent tot el dia (00:00:00)
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - lastDays);
		cutoffDate.setHours(0, 0, 0, 0); // Assegurar hora 00:00:00
		log(`Date filtering: cutoff date ${cutoffDate.toLocaleDateString('ca-ES')} (last ${lastDays} days)`, 'debug');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (i === 0) {
				// Primera línia: sempre és la capçalera
				filteredLines.push(line.trim());
				continue;
			}

			if (!line.trim()) { continue; } // Saltar línies buides

			// Parsejar la línia CSV per obtenir la data
			const recordDate = extractDateFromCSVLine(line);

			if (recordDate) {
				if (recordDate >= cutoffDate) {
					// Registre dins del rang de dates
					filteredLines.push(line.trim());
					filteredRecords++;
				} else {
					// Primer registre fora del rang, aturar el processament
					log(`Stopping at record outside date range: ${recordDate.toISOString()} < ${cutoffDate.toISOString()}`, 'debug');
					break;
				}
			} else {
				// Si no es pot parsejar la data, mantenir el registre per seguretat
				filteredLines.push(line.trim());
				filteredRecords++;
				log(`Record with unparseable date kept: ${line.substring(0, 100)}...`, 'debug');
			}

			totalRecords++;
		}

		// Crear fitxer filtrat per data en el mateix directori
		const dir = path.dirname(inputPath);
		const dateFilteredPath = path.join(dir, 'SetupAuditTrail-DateFiltered.csv');
		fs.writeFileSync(dateFilteredPath, filteredLines.join('\n'));

		log(`CSV filtered by date: ${totalRecords} → ${filteredRecords} records`, 'debug');
		return {dateFilteredPath, totalRecords, filteredRecords};

	} catch (error) {
		log(`Error filtering CSV by date: ${error.message}`, 'error');
		throw error;
	}
}

/**
 * Filtra el fitxer CSV per usuari (només si username té valor)
 */
function filterCSVByUser(inputPath, username) {
	// Si no s'especifica usuari, retornar el fitxer sense canvis
	if (!username) {
		log('No user filter specified, skipping user filtering', 'debug');
		return {
			userFilteredPath: inputPath,
			totalRecords: 0,
			filteredRecords: 0,
			skipped: true
		};
	}

	try {
		const data = fs.readFileSync(inputPath, 'utf8');
		const lines = data.split('\n');
		const filteredLines = [];
		let totalRecords = 0;
		let filteredRecords = 0;

		log(`User filtering: keeping only records from user "${username}"`, 'debug');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (i === 0) {
				// Primera línia: sempre és la capçalera
				filteredLines.push(line.trim());
				continue;
			}

			if (!line.trim()) { continue; } // Saltar línies buides

			// Parsejar la línia CSV per obtenir l'usuari
			const recordUser = extractUserFromCSVLine(line);

			if (recordUser === username) {
				// Registre de l'usuari especificat
				filteredLines.push(line.trim());
				filteredRecords++;
			}

			totalRecords++;
		}

		// Crear fitxer filtrat per usuari en el mateix directori
		const dir = path.dirname(inputPath);
		const userFilteredPath = path.join(dir, 'SetupAuditTrail-UserFiltered.csv');
		fs.writeFileSync(userFilteredPath, filteredLines.join('\n'));

		log(`CSV filtered by user: ${totalRecords} → ${filteredRecords} records`, 'debug');
		return {userFilteredPath, totalRecords, filteredRecords, skipped: false};

	} catch (error) {
		log(`Error filtering CSV by user: ${error.message}`, 'error');
		throw error;
	}
}

/**
 * Filtra el fitxer CSV per metadataName (només si metadataName té valor)
 */
function filterCSVByMetadataName(inputPath, metadataName) {
	// Si no s'especifica metadataName, retornar el fitxer sense canvis
	if (!metadataName) {
		log('No metadata name filter specified, skipping metadata name filtering', 'debug');
		return {
			metadataNameFilteredPath: inputPath,
			totalRecords: 0,
			filteredRecords: 0,
			skipped: true
		};
	}

	try {
		const data = fs.readFileSync(inputPath, 'utf8');
		const lines = data.split('\n');
		const filteredLines = [];
		let totalRecords = 0;
		let filteredRecords = 0;

		log(`Metadata name filtering: keeping only records where Action contains "${metadataName}"`, 'debug');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (i === 0) {
				// Primera línia: sempre és la capçalera
				filteredLines.push(line.trim());
				continue;
			}

			if (!line.trim()) { continue; } // Saltar línies buides

			// Parsejar la línia CSV per obtenir l'Action
			const recordAction = extractActionFromCSVLine(line);

			if (recordAction && recordAction.includes(metadataName)) {
				// Registre amb Action que conté metadataName
				filteredLines.push(line.trim());
				filteredRecords++;
			}

			totalRecords++;
		}

		// Crear fitxer filtrat per metadataName en el mateix directori
		const dir = path.dirname(inputPath);
		const metadataNameFilteredPath = path.join(dir, 'SetupAuditTrail-MetadataNameFiltered.csv');
		fs.writeFileSync(metadataNameFilteredPath, filteredLines.join('\n'));

		log(`CSV filtered by metadata name: ${totalRecords} → ${filteredRecords} records`, 'debug');
		return {metadataNameFilteredPath, totalRecords, filteredRecords, skipped: false};

	} catch (error) {
		log(`Error filtering CSV by metadata name: ${error.message}`, 'error');
		throw error;
	}
}

/**
 * Extrau el camp Section d'una línia CSV
 */
function extractSectionFromCSVLine(line) {
	try {
		// Parsejar la línia CSV correctament
		const fields = parseCSVLine(line);
		if (fields && fields.length >= 5) {
			// El 5è camp és Section (index 4)
			return fields[4];
		}
		return null;
	} catch (error) {
		log(`Error extracting section from line: ${error.message}`, 'debug');
		return null;
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
 * Extrau la data d'una línia CSV
 */
function extractDateFromCSVLine(line) {
	try {
		// Buscar el primer camp (data) entre cometes
		const dateMatch = line.match(/^"([^"]+)"/);
		if (dateMatch) {
			const dateString = dateMatch[1];
			return parseSalesforceDate(dateString);
		}
		return null;
	} catch (error) {
		log(`Error extracting date from line: ${error.message}`, 'debug');
		return null;
	}
}

/**
 * Extrau l'usuari d'una línia CSV
 */
function extractUserFromCSVLine(line) {
	try {
		// Parsejar la línia CSV correctament
		const fields = parseCSVLine(line);
		if (fields && fields.length >= 2) {
			// El 2n camp és User (index 1)
			return fields[1];
		}
		return null;
	} catch (error) {
		log(`Error extracting user from line: ${error.message}`, 'debug');
		return null;
	}
}

/**
 * Extrau el camp Action d'una línia CSV
 */
function extractActionFromCSVLine(line) {
	try {
		// Parsejar la línia CSV correctament
		const fields = parseCSVLine(line);
		if (fields && fields.length >= 4) {
			// El 4t camp és Action (index 3)
			return fields[3];
		}
		return null;
	} catch (error) {
		log(`Error extracting action from line: ${error.message}`, 'debug');
		return null;
	}
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

		log('Starting Setup Audit Trail file download...', 'debug');
		let filePath = null;

		try {
			filePath = await retrieveSetupAuditTrailFile();
		} catch (downloadError) {
			log(`Setup Audit Trail file download error: ${downloadError.message}`, 'error');
			throw downloadError;
		}

		if (!filePath || !fs.existsSync(filePath)) {
			throw new Error('Could not retrieve Setup Audit Trail data. The file was not downloaded.');
		}

		// Step 1: Normalize the CSV file (convert multi-line records to single-line)
		log('Normalizing CSV file...', 'debug');
		const normalizedFilePath = normalizeCSVFile(filePath);

		// Step 2: Filter by relevant sections
		log('Filtering CSV by relevant sections...', 'debug');
		const {filteredPath, totalRecords, filteredRecords} = filterCSVBySections(normalizedFilePath);

		// Step 3: Filter by date (last X days)
		log('Filtering CSV by date...', 'debug');
		const {dateFilteredPath, totalRecords: totalRecordsAfterDateFilter, filteredRecords: filteredRecordsAfterDateFilter} = filterCSVByDate(filteredPath, lastDays);

		// Step 4: Filter by user (if username is provided)
		log('Filtering CSV by user...', 'debug');
		const {userFilteredPath, totalRecords: totalRecordsAfterUserFilter, filteredRecords: filteredRecordsAfterUserFilter} = filterCSVByUser(dateFilteredPath, username);

		// Step 5: Filter by metadata name (if metadataName is provided)
		log('Filtering CSV by metadata name...', 'debug');
		const {metadataNameFilteredPath, totalRecords: totalRecordsAfterMetadataNameFilter, filteredRecords: filteredRecordsAfterMetadataNameFilter} = filterCSVByMetadataName(userFilteredPath, metadataName);

		// Get file stats for size information
		const fileStats = fs.statSync(metadataNameFilteredPath);
		const fileSize = fileStats.size;

		// Read filtered file content for the resource
		const fileContent = fs.readFileSync(metadataNameFilteredPath, 'utf8');

		newResource(
			resourceUri,
			'Setup audit trail CSV (filtered)',
			'Setup audit trail CSV with relevant sections only',
			'text/csv',
			fileContent,
			{audience: ['user', 'assistant']}
		);

		const content = [{
			type: 'text',
			text: `Setup audit trail CSV processed successfully. Original: ${totalRecords} records, Filtered by Sections: ${filteredRecords} records, Filtered by Date: ${filteredRecordsAfterDateFilter} records, Filtered by User: ${filteredRecordsAfterUserFilter} records, Filtered by Metadata Name: ${filteredRecordsAfterMetadataNameFilter} records. File size: ${fileSize} bytes. Filtered file path: ${metadataNameFilteredPath}`
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
				originalFilePath: filePath,
				normalizedFilePath,
				filteredFilePath: filteredPath,
				dateFilteredFilePath: dateFilteredPath,
				userFilteredFilePath: userFilteredPath,
				metadataNameFilteredFilePath: metadataNameFilteredPath,
				sectionFilterStats: {
					totalRecords,
					filteredRecords
				},
				dateFilterStats: {
					totalRecords: totalRecordsAfterDateFilter,
					filteredRecords: filteredRecordsAfterDateFilter
				},
				userFilterStats: {
					totalRecords: totalRecordsAfterUserFilter,
					filteredRecords: filteredRecordsAfterUserFilter
				},
				metadataNameFilterStats: {
					totalRecords: totalRecordsAfterMetadataNameFilter,
					filteredRecords: filteredRecordsAfterMetadataNameFilter
				},
				fileSize,
				rawContent: fileContent
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
