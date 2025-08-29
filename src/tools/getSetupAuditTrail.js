import {textFileContent} from '../utils.js';
import {createModuleLogger} from '../lib/logger.js';
import {newResource} from '../mcp-server.js';
import {z} from 'zod';
import {retrieveSetupAuditTrailFile} from '../lib/auditTrailDownloader.js';
import {executeSoqlQuery} from '../lib/salesforceServices.js';
import state from '../state.js';
import client from '../client.js';
import fs from 'fs';
import path from 'path';
const logger = createModuleLogger(import.meta.url);

export const getSetupAuditTrailToolDefinition = {
	name: 'getSetupAuditTrail',
	title: 'Get the changes in the Salesforce org metadata performed in the last days from the Salesforce Setup Audit Trail data, filtered by allowed sections',
	description: textFileContent('tools/getSetupAuditTrail.md'),
	inputSchema: {
		lastDays: z.number()
			.int()
			.min(1)
			.max(60)
			.optional()
			.default(30)
			.describe('Number of days to query (between 1 and 90)'),
		user: z.string()
			.optional()
			.describe('Accepts a username or a name. Only the changes performed by this username will be returned. If not set the changes from all users will be returned'),
		metadataName: z.string()
			.optional()
			.describe('Name of the metadata component to get the changes of (e.g. "FOO_AlertMessages_Controller", "FOO_AlertMessage__c", "FOO_AlertNessageList_LWC", etc.)')
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Returns the changes in the Salesforce org metadata registered in the Setup Audit Trail data. Allows filtering by user, last N days and metadata component name'
	}
};

// Allowed sections (deduped) for relevant setup changes
const ALLOWED_SECTIONS = new Set([
	'Apex Class', 'Lightning Components', 'Lightning Pages', 'Groups', 'Custom Objects', 'Sharing Rules',
	'Customize Cases', 'Customize Entitlement Process', 'Named Credentials', 'Customize Activities',
	'Custom Apps', 'Apex Trigger', 'Rename Tabs and Labels', 'Custom Tabs', 'Custom Metadata Types',
	'Validation Rules', 'Static Resource', 'Data Management', 'Field Dependencies', 'Customize Opportunities',
	'Omni-Channel', 'Application', 'Global Value Sets', 'Triggers Settings', 'External Credentials',
	'Custom Permissions', 'Customize Accounts', 'Customize Contacts', 'Standard Buttons and Links', 'Flows',
	'Workflow Rule', 'Manage apps', 'Sharing Defaults', 'Connected Apps', 'Customize Chat Transcripts',
	'Global Actions', 'Customize Content', 'Timeline Configurations [bmpyrckt]', 'Page', 'User Interface',
	'Component', 'Customize Leads', 'Customize Contracts'
]);

// In-memory caches to reduce latency across calls
let normalizedCache = {
	path: null,
	mtimeMs: 0,
	lines: null
};

const USERNAME_NAME_CACHE = new Map(); // username -> { name, cachedAt }
const USERNAME_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Normalitza el fitxer CSV convertint registres multi-línia en registres d'una sola línia
 */
function normalizeMultilineFields(inputPath) {
	try {
		const data = fs.readFileSync(inputPath, 'utf8');
		const lines = data.split('\n');
		const out = [];
		let current = '';
		const newRecord = /^"\d{1,2}\/\d{1,2}\/\d{4},/;

		for (let i = 0; i < lines.length; i++) {
			const raw = lines[i] ?? '';
			const line = raw.trimEnd();
			if (i === 0) {
				out.push(line.trim()); continue;
			}
			if (newRecord.test(line)) {
				current && out.push(current);
				current = line.trim();
			} else if (line.length) {
				current += (current ? ' ' : '') + line.trim();
			}
		}
		current && out.push(current);
		return out;
	} catch (error) {
		logger.error(`Error normalizing CSV: ${error.message}`);
		throw error;
	}
}

// Parse a record, manages escaped delimiters ("")
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
 * Check if a text contains an exact word (no partial)
 * Uses word boundaries to avoid false positives
 * Also recognizes underscores as word delimiters
 */
function containsExactWord(text, word) {
	if (!text || !word) {
		return false;
	}
	const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const wordBoundaryRegex = new RegExp(`(^|[^a-zA-Z0-9_])${escapedWord}([^a-zA-Z0-9_]|$)`, 'i');
	return wordBoundaryRegex.test(text);
}

/**
 * Aplica tots els filtres en memòria i crea només el fitxer final
 */
function applyAllFilters(lines, lastDays, username, metadataName) {
	try {
		const out = [];
		let finalFilteredRecords = 0;
		const usernamesSet = new Set();

		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - lastDays);
		cutoff.setHours(0, 0, 0, 0);

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (i === 0) {
				out.push(line.trim()); continue;
			}
			if (!line || !line.trim()) {
				continue;
			}

			const f = parseCSVLine(line);
			if (!f || f.length < 5) {
				continue;
			}

			const recordDate = parseSalesforceDate(f[0]);
			const recordUser = f[1];
			const recordSection = f[4];
			const recordAction = f[3];

			if (!ALLOWED_SECTIONS.has(recordSection)) {
				continue;
			}
			if (recordDate && recordDate < cutoff) {
				continue;
			}
			if (username && recordUser !== username) {
				continue;
			}
			if (metadataName && !containsExactWord(recordAction, metadataName)) {
				continue;
			}

			out.push(line.trim());
			finalFilteredRecords++;
			recordUser && usernamesSet.add(recordUser);
		}

		return {
			filteredLines: out,
			totalRecords: Math.max(0, lines.length - 1),
			finalFilteredRecords,
			uniqueUsernames: Array.from(usernamesSet)
		};
	} catch (error) {
		logger.error(`Error applying all filters: ${error.message}`);
		throw error;
	}
}

/**
 * Converteix el contingut CSV en un array d'objectes amb els canvis
 */
function parseCSVToRecords(csvContent, userNamesMap = {}) {
	if (!csvContent) {
		return [];
	}

	const lines = csvContent.split('\n');
	const records = [];

	// Saltar la primera línia (capçalera)
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) {
			continue;
		} // Saltar línies buides

		try {
			const fields = parseCSVLine(line);
			if (fields && fields.length >= 5) {
				const username = fields[1];
				const record = {
					date: formatDateToLocal(fields[0]),
					user: userNamesMap[username] || username,
					type: fields[4],
					action: fields[3]
				};
				records.push(record);
			}
		} catch {
			continue;
		}
	}

	return records;
}

/**
 * Converteix una data de Salesforce al format local D/M/YY HH:MI
 */
function formatDateToLocal(dateString) {
	if (!dateString || typeof dateString !== 'string') {
		return '';
	}

	try {
		// Parsejar la data de Salesforce (ex: "27/8/2025, 14:06:53 CEST")
		const dateMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{1,2}):(\d{1,2})/);
		if (dateMatch) {
			const day = parseInt(dateMatch[1]);
			const month = parseInt(dateMatch[2]);
			const year = parseInt(dateMatch[3]);
			const hours = parseInt(dateMatch[4]);
			const minutes = parseInt(dateMatch[5]);

			// Crear data local
			const date = new Date(year, month - 1, day, hours, minutes);

			// Formatar a D/M/YY HH:MI
			const formattedDay = date.getDate();
			const formattedMonth = date.getMonth() + 1;
			const formattedYear = date.getFullYear().toString().slice(-2);
			const formattedHours = date.getHours().toString().padStart(2, '0');
			const formattedMinutes = date.getMinutes().toString().padStart(2, '0');

			return `${formattedDay}/${formattedMonth}/${formattedYear} ${formattedHours}:${formattedMinutes}`;
		}

		return dateString; // Retornar original si no es pot parsejar
	} catch {
		return dateString;
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
		// Try D/M/YYYY first (common in exported CSV)
		const eu = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
		if (eu) {
			const day = parseInt(eu[1]);
			const month = parseInt(eu[2]) - 1;
			const year = parseInt(eu[3]);
			return new Date(year, month, day);
		}
		const d = new Date(dateString);
		return isNaN(d.getTime()) ? null : d;
	} catch {
		return null;
	}
}

/**
 * Obté els noms dels usuaris a partir dels usernames
 */
async function getUserNamesFromUsernames(usernames) {
	if (!usernames || usernames.length === 0) {
		return {};
	}

	try {
		// Split by cache hits/misses
		const now = Date.now();
		const toFetch = [];
		const userMap = {};

		for (const uname of usernames) {
			const cached = USERNAME_NAME_CACHE.get(uname);
			if (cached && (now - cached.cachedAt) < USERNAME_CACHE_TTL_MS) {
				userMap[uname] = cached.name;
			} else {
				toFetch.push(uname);
			}
		}

		if (toFetch.length) {
			const usernameList = toFetch.map(username => `'${username.replace(/'/g, "\\'")}'`).join(',');
			const soqlQuery = `SELECT Id, Username, Name FROM User WHERE Username IN (${usernameList})`;
			const queryResult = await executeSoqlQuery(soqlQuery);
			if (queryResult && queryResult.records) {
				queryResult.records.forEach(record => {
					userMap[record.Username] = record.Name;
					USERNAME_NAME_CACHE.set(record.Username, {name: record.Name, cachedAt: now});
				});
			}
		}

		logger.debug(`Resolved ${Object.keys(userMap).length} user names (fetched ${toFetch.length})`);
		return userMap;
	} catch (error) {
		logger.error(`Error getting user names: ${error.message}`);
		// Retornar un map buit en cas d'error, així la tool pot continuar funcionant
		return {};
	}
}

/**
 * Comprimeix el camp Action per a registres específics per reduir la mida de la resposta
 * Si el camp Action conté la paraula exacta "Changed" o "Created", el substituïsca per "Changed" o "Created" respectivament
 */
function compressActionField(records) {
	if (!records || !Array.isArray(records)) {
		return records;
	}

	return records.map(r => {
		if (r.type === 'Lightning Components' || r.type === 'Apex Class') {
			if (containsExactWord(r.action, 'Changed')) {
				return {...r, action: 'Changed'};
			}
			if (containsExactWord(r.action, 'Created')) {
				return {...r, action: 'Created'};
			}
		}
		return r;
	});
}

// Return a fresh local CSV path: reuse tmp file if younger than 1h, otherwise download
function getFreshAuditTrailFilePath() {
	const tmpDir = path.join(process.cwd(), 'tmp');
	const filePath = path.join(tmpDir, 'SetupAuditTrail.csv');
	try {
		if (fs.existsSync(filePath)) {
			const ageMs = Date.now() - fs.statSync(filePath).mtime.getTime();
			if (ageMs < 60 * 60 * 1000) {
				return filePath;
			}
		}
	} catch (e) {
		logger.debug(`Error checking cached Setup Audit Trail file: ${e.message}`);
	}
	return null;
}

export async function getSetupAuditTrailToolHandler({lastDays = 30, user = null, metadataName = null}) {
	try {
		// Resolve optional user filter: accepts username or Name
		const resolveUser = async (u) => {
			if (!u) {
				return {usernameForFiltering: null, resolvedUsername: null};
			}
			if (u.trim().toLowerCase() === 'me') {
				const me = state?.org?.user?.username || null;
				return {usernameForFiltering: me, resolvedUsername: me};
			}
			if (u.includes('@')) {
				return {usernameForFiltering: u, resolvedUsername: u};
			}
			const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
			try {
				const raw = u.trim();
				const exactQ = `SELECT Username, Name, IsActive, LastLoginDate FROM User WHERE Name = '${esc(raw)}' ORDER BY IsActive DESC, LastLoginDate DESC NULLS LAST LIMIT 5`;
				let res = await executeSoqlQuery(exactQ);
				if (!res?.records?.length) {
					const tokens = raw.split(/\s+/).filter(Boolean).map(esc);
					const where = tokens.map(t => `Name LIKE '%${t}%'`).join(' AND ') || `Name LIKE '%${esc(raw)}%'`;
					res = await executeSoqlQuery(`SELECT Username, Name, IsActive, LastLoginDate FROM User WHERE ${where} ORDER BY IsActive DESC, LastLoginDate DESC NULLS LAST LIMIT 5`);
				}
				if (res?.records?.length) {
					const uname = res.records[0].Username;
					logger.info(`Resolved user '${u}' to username '${uname}'`);
					return {usernameForFiltering: uname, resolvedUsername: uname};
				}
				logger.warn(`No matching User found for name '${u}'. Returning 0 records for user filter.`);
				return {usernameForFiltering: '__NO_MATCH__', resolvedUsername: null};
			} catch (e) {
				logger.error(`Error resolving user '${u}' to username: ${e.message}`);
				return {usernameForFiltering: '__NO_MATCH__', resolvedUsername: null};
			}
		};

		const {usernameForFiltering, resolvedUsername} = await resolveUser(user);

		const fileName = 'SetupAuditTrail.csv';
		// Use an MCP-scoped URI so clients (e.g., VS Code) resolve resource_links via MCP resources
		const resourceUri = `mcp://setupAuditTrail/${fileName}`;

		let filePath = getFreshAuditTrailFilePath();
		if (!filePath) {
			try {
				filePath = await retrieveSetupAuditTrailFile();
			} catch (downloadError) {
				logger.error(`Setup Audit Trail file download error: ${downloadError.message}`);
				throw downloadError;
			}
			if (!filePath || !fs.existsSync(filePath)) {
				throw new Error('Could not retrieve Setup Audit Trail data. The file was not downloaded.');
			}
		}

		// Normalize and filter in memory, with caching by file mtime
		let normalizedLines;
		try {
			const {mtimeMs} = fs.statSync(filePath);
			if (normalizedCache.path === filePath && normalizedCache.mtimeMs === mtimeMs && Array.isArray(normalizedCache.lines)) {
				normalizedLines = normalizedCache.lines;
			} else {
				normalizedLines = normalizeMultilineFields(filePath);
				normalizedCache = {path: filePath, mtimeMs, lines: normalizedLines};
			}
		} catch {
			normalizedLines = normalizeMultilineFields(filePath);
		}
		const {filteredLines, totalRecords, finalFilteredRecords, uniqueUsernames} = applyAllFilters(normalizedLines, lastDays, usernameForFiltering, metadataName);

		const originalFileContent = fs.readFileSync(filePath, 'utf8');

		// Step 3: Get user names from usernames
		const userNamesMap = await getUserNamesFromUsernames(uniqueUsernames);

		// Parse filtered lines into records
		const records = parseCSVToRecords(filteredLines.join('\n'), userNamesMap);

		// Comprimir el camp Action per reduir la mida de la resposta
		const compressedRecords = compressActionField(records);

		newResource(resourceUri, 'Setup audit trail CSV', 'Setup audit trail CSV', 'text/csv', originalFileContent, {audience: ['user', 'assistant']});

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
					user,
					metadataName,
					resolvedUsername
				},
				setupAuditTrailFileTotalRecords: totalRecords,
				setupAuditTrailFileFilteredTotalRecords: finalFilteredRecords,
				records: compressedRecords
			}
		};

	} catch (error) {
		logger.error(error, 'Error getting setup audit trail data');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `Error retrieving Setup Audit Trail data:\n\nError message:\n${error.message}\n\nError stack:\n${error.stack}`
			}]
		};
	}
}
