import {log, textFileContent} from '../utils.js';
import {newResource} from '../mcp-server.js';
import fs from 'fs/promises';
import path from 'path';
import {z} from 'zod';
import state from '../state.js';
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

		// Utilitzar auditTrailDownloader.js per obtenir el contingut del CSV
		log('Iniciant descàrrega del Setup Audit Trail...', 'debug');
		let fileContent = null;

		try {
			fileContent = await retrieveSetupAuditTrailFile();
		} catch (downloadError) {
			log(`Error en la descàrrega: ${downloadError.message}`, 'warn');
			fileContent = null;
		}

		// Si la descàrrega falla, provar de carregar des del sistema de fitxers
		if (!fileContent || fileContent.trim() === '') {
			throw new Error('No s\'ha pogut obtenir dades del Setup Audit Trail. El fitxer està buit.');
		}

		log(`Contingut del fitxer obtingut. Longitud: ${fileContent.length} caràcters`, 'debug');

		// Debug del contingut CSV
		debugCsvContent(fileContent);

		// Filter out records with empty QualifiedApiName (first column)
		const originalLines = fileContent.split('\n');
		log(`Línies originals: ${originalLines.length}`, 'debug');

		fileContent = originalLines.filter((line, index) => {
			// Keep header row (index 0)
			if (index === 0) {
				return true;
			}

			// For data rows, check if first column (QualifiedApiName) is not empty
			const firstColumn = line.split(',')[0];
			return firstColumn && firstColumn.trim() !== '';
		}).join('\n');

		log(`Línies després del filtrat: ${fileContent.split('\n').length}`, 'debug');

		// Convertir CSV a JSON i processar les dades
		const allData = csvToJson(fileContent);
		log(`Registres JSON generats: ${allData.length}`, 'debug');

		// Mostrar els primers registres per debugging
		if (allData.length > 0) {
			log(`Primer registre: ${JSON.stringify(allData[0])}`, 'debug');
			log(`Camps disponibles: ${Object.keys(allData[0]).join(', ')}`, 'debug');
		}

		// Analitzar per què es filtren els registres
		showFilteredOutRecords(allData, lastDays, createdByName, metadataName);

		// Filtrar les dades segons els paràmetres
		const filteredData = filterAuditTrailData(allData, lastDays, createdByName, metadataName);
		log(`Registres després del filtrat: ${filteredData.length}`, 'debug');

		// Mostrar estadístiques dels registres trobats
		showRecordStatistics(filteredData);

		// Crear el directori tmp si no existeix
		const tmpDir = path.join(state.workspacePath, 'tmp');
		await fs.mkdir(tmpDir, {recursive: true});

		// Guardar el contingut del CSV a un fitxer al directori tmp
		const csvFilePath = path.join(tmpDir, fileName);
		await fs.writeFile(csvFilePath, jsonToCsv(filteredData), 'utf8');

		log(`CSV guardat a: ${csvFilePath}`, 'debug');

		// Crear el resource amb les dades filtrades, no amb totes les dades
		newResource(
			resourceUri,
			fileName,
			'Setup audit trail CSV',
			'text/csv',
			fileContent,
			{audience: ['user', 'assistant']}
		);

		const content = [{
			type: 'text',
			text: `Setup audit trail CSV downloaded successfully. Found ${filteredData.length} records matching the criteria.`
		}];

		return {
			content,
			structuredContent: {
				filters: {
					lastDays,
					createdByName,
					metadataName
				},
				count: filteredData.length,
				records: filteredData,
				debug: {
					originalLines: originalLines.length,
					processedLines: fileContent.split('\n').length,
					jsonRecords: allData.length,
					filteredRecords: filteredData.length
				}
			}
		};

	} catch (error) {
		log(error, 'error', 'Error getting setup audit trail data');
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
 * Intenta carregar el fitxer CSV des del sistema de fitxers com a fallback
 */
async function loadCsvFromFilesystem() {
	try {
		const tmpDir = path.join(state.workspacePath, 'tmp');
		const csvFiles = await fs.readdir(tmpDir);

		// Buscar fitxers CSV que continguin "SetupAuditTrail" o "setupAuditTrail"
		const setupAuditTrailFiles = csvFiles.filter(file =>
			file.toLowerCase().includes('setupeaudittrail') ||
			file.toLowerCase().includes('audittrail')
		);

		if (setupAuditTrailFiles.length === 0) {
			log('No s\'han trobat fitxers CSV d\'audit trail al directori tmp', 'warn');
			return null;
		}

		// Carregar el fitxer més recent
		const mostRecentFile = setupAuditTrailFiles[0];
		const filePath = path.join(tmpDir, mostRecentFile);
		const fileContent = await fs.readFile(filePath, 'utf8');

		log(`Fitxer CSV carregat des del sistema de fitxers: ${mostRecentFile}`, 'debug');
		return fileContent;

	} catch (error) {
		log(`Error carregant fitxer CSV del sistema de fitxers: ${error.message}`, 'error');
		return null;
	}
}

/**
 * Intenta carregar el fitxer CSV des del directori de CaixaBank
 */
async function loadCsvFromCaixaBank() {
	try {
		const caixaBankDir = '/Users/marcpla/Documents/Feina/Projectes/CaixaBank/tmp';
		const csvFiles = await fs.readdir(caixaBankDir);

		// Buscar fitxers CSV que continguin "SetupAuditTrail"
		const setupAuditTrailFiles = csvFiles.filter(file =>
			file.toLowerCase().includes('setupeaudittrail')
		);

		if (setupAuditTrailFiles.length === 0) {
			log('No s\'han trobat fitxers CSV d\'audit trail al directori de CaixaBank', 'warn');
			return null;
		}

		// Carregar el fitxer més recent
		const mostRecentFile = setupAuditTrailFiles[0];
		const filePath = path.join(caixaBankDir, mostRecentFile);
		const fileContent = await fs.readFile(filePath, 'utf8');

		log(`Fitxer CSV carregat des del directori de CaixaBank: ${mostRecentFile}`, 'debug');
		return fileContent;

	} catch (error) {
		log(`Error carregant fitxer CSV del directori de CaixaBank: ${error.message}`, 'error');
		return null;
	}
}

/**
 * Converteix CSV a JSON sense processament addicional
 */
function csvToJson(csvContent) {
	log('Iniciant conversió CSV a JSON', 'debug');

	const lines = csvContent.split('\n').filter(line => line.trim());
	log(`Línies CSV a processar: ${lines.length}`, 'debug');

	if (lines.length === 0) {
		log('No hi ha línies per processar', 'warn');
		return [];
	}

	const headers = parseCsvLine(lines[0]).map(h => h.trim().replace(/"/g, ''));
	log(`Capçaleres trobades: ${headers.join(', ')}`, 'debug');

	const jsonData = [];

	for (let i = 1; i < lines.length; i++) {
		if (!lines[i]?.trim()) {
			log(`Línia ${i} buida, saltant...`, 'debug');
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
			log(`Contingut de la línia: ${lines[i]}`, 'debug');
		}
	}

	log(`Registres JSON generats: ${jsonData.length}`, 'debug');
	return jsonData;
}

/**
 * Parseja una línia CSV tenint en compte les cometes
 */
function parseCsvLine(line) {
	if (!line || typeof line !== 'string') {
		log(`Línia invàlida per parsejar: ${line}`, 'warn');
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

	// Afegir l'últim valor
	values.push(currentValue.replace(/"/g, '').trim());

	log(`Línia parsejada amb ${values.length} valors`, 'debug');
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
		// Eliminar la zona horària i la coma
		const cleanDateString = dateString.replace(/,?\s*[A-Z]{3}$/, '').replace(',', '');

		// Parsejar la data
		const parts = cleanDateString.split(' ');
		if (parts.length >= 2) {
			const datePart = parts[0]; // "3/3/2025"
			const timePart = parts[1]; // "8:47:34"

			const dateParts = datePart.split('/');
			if (dateParts.length === 3) {
				const month = parseInt(dateParts[0]) - 1; // Mesos són 0-based
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

function jsonToCsv(jsonData) {
	// Check if jsonData is empty or undefined
	if (!jsonData || jsonData.length === 0) {
		return '';
	}

	const headers = Object.keys(jsonData[0]);
	const csvContent = [headers.join(',')];

	for (const record of jsonData) {
		const row = headers.map(header => record[header]).join(',');
		csvContent.push(row);
	}

	return csvContent.join('\n');
}

/**
 * Filtra les dades de l'audit trail segons els paràmetres
 */
function filterAuditTrailData(data, lastDays, createdByName, metadataName) {
	log(`Iniciant filtrat amb ${data.length} registres`, 'debug');

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
	log(`Data de tall: ${cutoffDate.toISOString()}`, 'debug');

	let dateFiltered = 0;
	let userFiltered = 0;
	let metadataFiltered = 0;
	let actionFiltered = 0;

	const filteredData = data.filter(record => {
		// Filtrar per data amb validació
		const dateField = record.Date || record.CreatedDate || record.Timestamp;
		if (!dateField) {
			log(`Registre sense data: ${JSON.stringify(record)}`, 'debug');
			return false; // Skip records without date
		}

		const recordDate = parseSalesforceDate(dateField);
		if (!recordDate) {
			log(`Registre amb data invàlida: ${dateField}`, 'debug');
			return false; // Skip records with invalid date
		}

		if (recordDate < cutoffDate) {
			dateFiltered++;
			return false;
		}

		// Filtrar per usuari
		if (createdByName && record.CreatedBy && !record.CreatedBy.includes(createdByName)) {
			userFiltered++;
			return false;
		}

		// Filtrar per nom de metadata
		if (metadataName && record.Metadata && !record.Metadata.includes(metadataName)) {
			metadataFiltered++;
			return false;
		}

		// Filtrar per acció interessant - ser menys restrictiu
		const actionName = record.Action || record.Change || '';
		if (actionName && !interestingActions.has(actionName)) {
			// En lloc de filtrar per accions específiques, acceptem totes les accions
			// log(`Acció no interessant: ${actionName}`, 'debug');
			// actionFiltered++;
			// return false;
		}

		return true;
	});

	log('Filtrat completat:', 'debug');
	log(`  - Filtrats per data: ${dateFiltered}`, 'debug');
	log(`  - Filtrats per usuari: ${userFiltered}`, 'debug');
	log(`  - Filtrats per metadata: ${metadataFiltered}`, 'debug');
	log(`  - Filtrats per acció: ${actionFiltered}`, 'debug');
	log(`  - Registres finals: ${filteredData.length}`, 'debug');

	return filteredData;
}

/**
 * Mostra informació detallada sobre els registres que no passen el filtrat
 */
function showFilteredOutRecords(data, lastDays, createdByName, metadataName) {
	if (!data || data.length === 0) {
		log('No hi ha dades per analitzar el filtrat', 'warn');
		return;
	}

	log('=== ANÀLISI DELS REGISTRES FILTRATS ===', 'debug');

	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - lastDays);

	let dateFiltered = 0;
	let userFiltered = 0;
	let metadataFiltered = 0;
	let actionFiltered = 0;
	let passed = 0;

	// Definir les accions interessants localment
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
		'changedAuraComponent', 'PermSetRecordTypeAdded', 'PermSetFlsChanged', 'changedApexClass', 'changedLightningWebComponent'
	]);

	data.forEach(record => {
		// Filtrar per data
		const dateField = record.Date || record.CreatedDate || record.Timestamp;
		if (!dateField) {
			return;
		}

		const recordDate = parseSalesforceDate(dateField);
		if (!recordDate) {
			return;
		}

		if (recordDate < cutoffDate) {
			dateFiltered++;
			return;
		}

		// Filtrar per usuari
		if (createdByName && record.CreatedBy && !record.CreatedBy.includes(createdByName)) {
			userFiltered++;
			return;
		}

		// Filtrar per nom de metadata
		if (metadataName && record.Metadata && !record.Metadata.includes(metadataName)) {
			metadataFiltered++;
			return;
		}

		// Filtrar per acció interessant
		const actionName = record.Action || record.Change || '';
		if (actionName && !interestingActions.has(actionName)) {
			actionFiltered++;
			return;
		}

		passed++;
	});

	log('Resum del filtrat:', 'debug');
	log(`  - Total registres: ${data.length}`, 'debug');
	log(`  - Filtrats per data: ${dateFiltered}`, 'debug');
	log(`  - Filtrats per usuari: ${userFiltered}`, 'debug');
	log(`  - Filtrats per metadata: ${metadataFiltered}`, 'debug');
	log(`  - Filtrats per acció: ${actionFiltered}`, 'debug');
	log(`  - Registres que passen: ${passed}`, 'debug');

	// Mostrar alguns exemples de registres filtrats per acció
	if (actionFiltered > 0) {
		log('Exemples d\'accions filtrats:', 'debug');
		const filteredActions = new Set();
		data.forEach(record => {
			const actionName = record.Action || record.Change || '';
			if (actionName && !interestingActions.has(actionName)) {
				filteredActions.add(actionName);
			}
		});

		Array.from(filteredActions).slice(0, 10).forEach(action => {
			log(`  - ${action}`, 'debug');
		});
	}

	log('=== FI ANÀLISI ===', 'debug');
}

/**
 * Funció de debugging per mostrar informació detallada del processament
 */
function debugCsvContent(csvContent, maxLines = 5) {
	log('=== DEBUG CSV CONTENT ===', 'debug');
	log(`Longitud total: ${csvContent.length} caràcters`, 'debug');

	const lines = csvContent.split('\n');
	log(`Nombre total de línies: ${lines.length}`, 'debug');

	// Mostrar les primeres línies
	for (let i = 0; i < Math.min(maxLines, lines.length); i++) {
		log(`Línia ${i}: ${lines[i].substring(0, 100)}${lines[i].length > 100 ? '...' : ''}`, 'debug');
	}

	// Mostrar les últimes línies si hi ha moltes
	if (lines.length > maxLines) {
		log('...', 'debug');
		for (let i = lines.length - Math.min(maxLines, lines.length); i < lines.length; i++) {
			log(`Línia ${i}: ${lines[i].substring(0, 100)}${lines[i].length > 100 ? '...' : ''}`, 'debug');
		}
	}

	log('=== FI DEBUG CSV CONTENT ===', 'debug');
}

/**
 * Mostra estadístiques dels registres trobats
 */
function showRecordStatistics(data) {
	if (!data || data.length === 0) {
		log('No hi ha dades per mostrar estadístiques', 'warn');
		return;
	}

	log('=== ESTADÍSTIQUES DELS REGISTRES ===', 'debug');

	// Comptar per tipus d'acció
	const actionCounts = {};
	data.forEach(record => {
		const action = record.Action || record.Change || 'Unknown';
		actionCounts[action] = (actionCounts[action] || 0) + 1;
	});

	log('Comptatges per acció:', 'debug');
	Object.entries(actionCounts)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 10)
		.forEach(([action, count]) => {
			log(`  ${action}: ${count}`, 'debug');
		});

	// Comptar per usuari
	const userCounts = {};
	data.forEach(record => {
		const user = record.CreatedBy || record.User || 'Unknown';
		userCounts[user] = (userCounts[user] || 0) + 1;
	});

	log('Comptatges per usuari:', 'debug');
	Object.entries(userCounts)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 10)
		.forEach(([user, count]) => {
			log(`  ${user}: ${count}`, 'debug');
		});

	log('=== FI ESTADÍSTIQUES ===', 'debug');
}

/**
//Agrupa les dades per usuari per a la resposta estructurada
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
 */
