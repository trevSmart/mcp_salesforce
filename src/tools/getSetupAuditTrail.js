import {log, textFileContent, writeToTmpFile} from '../utils.js';
import {newResource} from '../mcp-server.js';
import {z} from 'zod';
import {retrieveSetupAuditTrailFile} from '../auditTrailDownloader.js';
import client from '../client.js';
import {exec} from 'child_process';
import {promisify} from 'util';

const execAsync = promisify(exec);

export const getSetupAuditTrailToolDefinition = {
	name: 'getSetupAuditTrail',
	title: 'Get the changes in the Salesforce org metadata performed in the last days from the Salesforce Setup Audit Trail data, filtered by allowed sections',
	description: textFileContent('getSetupAuditTrail'),
	inputSchema: {
		lastDays: z.number()
			.int()
			.max(30)
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
		title: 'Get the changes in the Salesforce org metadata performed in the last days from the Salesforce Setup Audit Trail data, filtered by allowed sections'
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

		// Aplicar filtres amb grep abans de parsejar a JSON
		const filteredCsvContent = await filterCsvWithGrep(fileContent, lastDays, createdByName, metadataName);
		log(`Contingut CSV filtrat amb grep: ${filteredCsvContent.length} bytes`, 'debug');

		// Parsejar només els registres filtrats a JSON
		const filteredData = parseCsvToJson(filteredCsvContent);
		log(`Registres després del filtrat amb grep: ${filteredData.length}`, 'debug');

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
 * Filtra el contingut CSV utilitzant grep per millorar la performance
 */
async function filterCsvWithGrep(csvContent, lastDays, createdByName, metadataName) {
	try {
		// Escriure el contingut CSV a un fitxer temporal per grep
		const tempFileName = `temp_audit_trail_${Date.now()}.csv`;
		const tempFilePath = writeToTmpFile(csvContent, tempFileName);

		// Construir la comanda grep per seccions permeses
		const allowedSectionsPattern = ALLOWED_SECTIONS.map(section =>
			section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escapar caràcters especials de regex
		).join('|');

		// Calcular la data de tall
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - lastDays);
		const cutoffDateStr = cutoffDate.toISOString().split('T')[0]; // Format YYYY-MM-DD

		// Construir la comanda completa utilitzant pipes correctament
		let grepCommand = `cat "${tempFilePath}" | awk -F',' 'NR==1 || (NR>1 && $1 >= "${cutoffDateStr}")'`;

		// Afegir filtre per seccions permeses
		grepCommand = `${grepCommand} | grep -E "(${allowedSectionsPattern})"`;

		// Afegir filtre per usuari si s'especifica
		if (createdByName) {
			const escapedUserName = createdByName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			grepCommand = `${grepCommand} | grep -E "(${escapedUserName})"`;
		}

		// Afegir filtre per metadata si s'especifica
		if (metadataName) {
			const escapedMetadataName = metadataName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			grepCommand = `${grepCommand} | grep -E "(${escapedMetadataName})"`;
		}

		log(`Executant comanda de filtrat: ${grepCommand}`, 'debug');

		// Executar la comanda
		const {stdout, stderr} = await execAsync(grepCommand, {shell: true});

		if (stderr) {
			log(`Warnings del filtrat: ${stderr}`, 'warn');
		}

		// Netejar el fitxer temporal
		try {
			await execAsync(`rm "${tempFilePath}"`);
		} catch (cleanupError) {
			log(`Error netejant fitxer temporal: ${cleanupError.message}`, 'warn');
		}

		return stdout;

	} catch (error) {
		log(`Error utilitzant grep per filtrar: ${error.message}`, 'error');
		// Fallback al mètode anterior si grep falla
		log('Utilitzant mètode de filtrat anterior com a fallback', 'warn');
		return filterAuditTrailDataFallback(csvContent, lastDays, createdByName, metadataName);
	}
}

/**
 * Mètode de fallback per al filtrat si grep falla
 */
function filterAuditTrailDataFallback(csvContent, lastDays, createdByName, metadataName) {
	const allData = parseCsvToJson(csvContent);
	const filteredData = filterAuditTrailData(allData, lastDays, createdByName, metadataName);

	// Convertir de tornada a CSV per mantenir la compatibilitat
	const headers = Object.keys(filteredData[0] || {});
	const csvLines = [headers.join(',')];

	filteredData.forEach(record => {
		const values = headers.map(header => {
			const value = record[header] || '';
			// Escapar cometes i afegir cometes si conté comes
			return value.includes(',') ? `"${value.replace(/"/g, '""')}"` : value;
		});
		csvLines.push(values.join(','));
	});

	return csvLines.join('\n');
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

		// Filtrar files que no comencen per dobles cometes
		if (!lines[i].trim().startsWith('"')) {
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

	// Substituir dobles cometes consecutives per cometa simple
	line = line.replace(/""/g, "'");

	const values = [];
	let inQuotes = false;
	let currentValue = '';

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			// És una cometa d'obertura/tancament de camp
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			// És un separador de camp (només si no estem dins de cometes)
			values.push(currentValue.trim());
			currentValue = '';
		} else {
			// És un caràcter normal del valor
			currentValue += char;
		}
	}

	// Afegir l'últim valor
	values.push(currentValue.trim());
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
 * Seccions permeses per l'audit trail
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
 * Filtra les dades de l'audit trail segons els paràmetres (mètode legacy)
 */
function filterAuditTrailData(data, lastDays, createdByName, metadataName) {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - lastDays);

	log(`Data de tall per filtrat: ${cutoffDate.toISOString()} (últims ${lastDays} dies)`, 'debug');

	let filteredCount = 0;
	let sectionFilteredCount = 0;
	let dateFilteredCount = 0;
	let userFilteredCount = 0;
	let metadataFilteredCount = 0;

	const filteredData = data.filter(record => {
		// FILTRE OBLIGATORI: Només seccions permeses
		const section = record.Section || record.SectionType;
		if (!section || !ALLOWED_SECTIONS.includes(section)) {
			sectionFilteredCount++;
			return false;
		}

		// Filtrar per data
		const dateField = record.Date || record.CreatedDate || record.Timestamp;
		if (!dateField) {
			log(`Registre sense camp de data: ${JSON.stringify(record)}`, 'debug');
			return false;
		}

		const recordDate = parseSalesforceDate(dateField);
		if (!recordDate) {
			log(`No es pot parsejar la data: ${dateField}`, 'debug');
			return false;
		}

		if (recordDate < cutoffDate) {
			dateFilteredCount++;
			return false;
		}

		// Filtrar per usuari (si s'especifica)
		if (createdByName && record.CreatedBy !== createdByName) {
			userFilteredCount++;
			return false;
		}

		// Filtrar per metadata (si s'especifica)
		if (metadataName && record.Metadata !== metadataName) {
			metadataFilteredCount++;
			return false;
		}

		filteredCount++;
		return true;
	});

	log('Resum del filtrat:', 'debug');
	log(`  - Registres amb seccions no permeses: ${sectionFilteredCount}`, 'debug');
	log(`  - Registres fora del rang de dates: ${dateFilteredCount}`, 'debug');
	log(`  - Registres d'usuaris no coincidents: ${userFilteredCount}`, 'debug');
	log(`  - Registres de metadata no coincident: ${metadataFilteredCount}`, 'debug');
	log(`  - Registres que passen tots els filtres: ${filteredCount}`, 'debug');

	return filteredData;
}
