import config from './config.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {mcpServer} from './mcp-server.js';
import client from './client.js';
import {executeSoqlQuery} from './salesforceServices.js';
import state from './state.js';

/**
 * Logs data with specified level and context
 * @param {any} data - Data to log (string, object, or Error)
 * @param {string} logLevel - Log level (emergency, alert, critical, error, warning, notice, info, debug)
 * @param {string|null} context - Optional context information
 */
export function log(data, logLevel = 'info', context = null) {
	try {
		const LEVEL_PRIORITIES = {emergency: 0, alert: 1, critical: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7};

		const logPriority = LEVEL_PRIORITIES[logLevel];
		const noticePriority = LEVEL_PRIORITIES['notice'];
		const currentPriority = LEVEL_PRIORITIES[state.currentLogLevel];
		const errorPriority = LEVEL_PRIORITIES['error'];
		const loggingSupported = client?.supportsCapability('logging');
		const shouldLog = loggingSupported && logPriority <= currentPriority;
		const shouldError = logPriority <= errorPriority || !loggingSupported && logPriority >= noticePriority;

		if (!shouldLog && !shouldError) {
			return;
		}

		let logData = data;

		// Handle Error objects specially
		if (data instanceof Error) {
			const errorMessage = context ? `${context}: ${data.message}` : data.message;
			logData = `${errorMessage}\nStack: ${data.stack}`;
		} else {
			// Add context prefix to any type of log if available
			if (context) {
				if (typeof data === 'string') {
					logData = `${context}: ${data}`;
				} else {
					// For non-string data, we'll add context after conversion to string
					logData = `${context}: ${logData}`;
				}
			}

			if (typeof data === 'object') {
				// For other objects, try to get meaningful string representation
				try {
					logData = JSON.stringify(data, null, 2);
				} catch {
					logData = data.toString();
				}
			} else if (typeof data === 'string') {
				logData = data;
			}
		}

		// Truncate if too long
		if (typeof logData === 'string' && logData.length > 5000) {
			logData = logData.slice(0, 4997) + '...';
		}

		// Add newlines for string data
		if (typeof logData === 'string') {
			logData = '\n' + logData + '\n';
		}

		const logPrefix = getLogPrefix(logLevel);
		if (shouldLog && mcpServer?.isConnected()) {
			const logger = `${logPrefix} MCP server`;
			mcpServer.server.sendLoggingMessage({level: logLevel, logger, data: logData});

		} else if (shouldError) {
			console.error(`${logPrefix} | ${logLevel} | ${logData}`);
		}

	} catch (error) {
		console.error(getLogPrefix('error') + JSON.stringify(error, null, 3));
	}
}

/**
 * Validates if the user has the required permissions
 * @param {string} username - The username to validate
 * @returns {Promise<void>}
 */
export async function validateUserPermissions(username) {
	const query = await executeSoqlQuery(`SELECT Id FROM PermissionSetAssignment WHERE Assignee.Username = '${username}' AND PermissionSet.Name = 'IBM_SalesforceMcpUser'`);
	if (query?.records?.length) {
		state.userValidated = true;
	} else {
		state.userValidated = false;
		log(`Insuficient permissions in org "${state.org.alias}"`, 'emergency');
	}
}

/*
export function notifyProgressChange(progressToken, total, progress, message) {
	if (!progressToken) {
		return;
	}
	mcpServer.server.notification({
		method: 'notifications/progress',
		params: {progressToken, progress, total, message}
	});
}
*/

/**
 * Reads content from a tool's description file (.md or .b64)
 * @param {string} toolName - Name of the tool
 * @returns {string|null} Content of the file or null if not found
 */
export function textFileContent(toolName) {
	try {
		//Calcular __dirname localment dins la funció
		const localFilename = fileURLToPath(import.meta.url);
		const localDirname = path.dirname(localFilename);
		let mdPath = path.join(localDirname, 'tools', `${toolName}.md`);
		if (!fs.existsSync(mdPath)) {
			mdPath = path.join(localDirname, 'tools', `${toolName}.b64`);
			if (!fs.existsSync(mdPath)) {
				throw new Error(`No description found for tool: ${toolName}`);
			}
		}

		const content = fs.readFileSync(mdPath, 'utf8');
		//Detecta si és base64 (Base64 típicament conté només caràcters alfanumèrics, +, /, i = per padding)
		const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(content.trim()) && content.length > 0;
		if (isBase64) {
			return Buffer.from(content, 'base64').toString('utf8');
		} else {
			return content;
		}

	} catch {
		return null;
	}
}

/**
 * Unified function to write files with consolidated functionality
 * @param {string|object} file - Either a full file path or filename (without extension)
 * @param {string|object} data - Content to write (string or object to be JSON.stringify'd)
 * @param {object} options - Configuration options
 * @param {boolean} options.async - Whether to write asynchronously (default: false)
 * @param {string} options.extension - File extension (default: 'json' if object, 'txt' if string)
 * @param {string} options.workspacePath - Workspace path for tmp directory (optional)
 * @returns {string|Promise<string>} Full path to the created file (Promise if async=true)
 */
export function writeToFile(file, data, options = {}) {
	const {
		async = false,
		extension,
		encoding = 'utf8',
		workspacePath = 'tmp'
	} = options;

	try {
		// Determine if file is a full path or just filename
		const isFullPath = file.includes('/') || file.includes('\\') || file.includes(path.sep);
		let fullPath;

		if (isFullPath) {
			// File is a full path
			fullPath = file;
			// Ensure directory exists
			const dir = path.dirname(fullPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, {recursive: true});
				log(`Created directory: ${dir}`, 'debug');
			}
		} else {
			// File is just a filename, use tmp directory
			const tmpDir = ensureTmpDir(workspacePath);
			const timestamp = getTimestamp();

			// Determine extension based on content type if not provided
			let finalExtension = extension;
			if (!finalExtension) {
				finalExtension = typeof data === 'object' ? 'json' : 'txt';
			}

			const fullFilename = `${file}_${timestamp}.${finalExtension}`;
			fullPath = path.join(tmpDir, fullFilename);
		}

		// Prepare content
		let content;
		if (typeof data === 'object' && !Buffer.isBuffer(data)) {
			content = JSON.stringify(data, null, 3);
		} else {
			content = data;
		}

		// Write file
		if (async) {
			return fs.promises.writeFile(fullPath, content, encoding).then(() => {
				log(`File written to: ${fullPath}`, 'debug');
				return fullPath;
			}).catch(error => {
				log(`Error writing to file: ${error.message}`, 'error');
				throw error;
			});
		} else {
			fs.writeFileSync(fullPath, content, encoding);
			log(`File written to: ${fullPath}`, 'debug');
			return fullPath;
		}

	} catch (error) {
		log(`Error writing to file: ${error.message}`, 'error');
		throw error;
	}
}

/**
 * Saves an object to a temporary JSON file
 * @param {object} object - Object to save
 * @param {string} filename - Base name for the file (without extension)
 */
export function saveToFile(object, filename) {
	const filePath = path.join(os.tmpdir(), `${filename}_${Date.now()}.json`);
	fs.writeFileSync(filePath, JSON.stringify(object, null, 3), 'utf8');
	log(`Object written to temporary file: ${filePath}`, 'debug');
}

/**
 * Ensures the tmp directory exists in the workspace
 * @param {string} workspacePath - Path to the workspace
 * @returns {string} Path to the tmp directory
 */
export function ensureTmpDir(workspacePath = null) {
	const tmpDir = workspacePath ? path.join(workspacePath, 'tmp') : path.join(process.cwd(), 'tmp');

	if (!fs.existsSync(tmpDir)) {
		fs.mkdirSync(tmpDir, {recursive: true});
		log(`Created tmp directory: ${tmpDir}`, 'debug');
	}

	return tmpDir;
}

/**
 * Writes content to a temporary file in the workspace tmp directory
 * @param {string} content - Content to write
 * @param {string} filename - Name of the file (without extension)
 * @param {string} extension - File extension (default: 'txt')
 * @param {string} encoding - File encoding (default: 'utf8')
 * @param {string} workspacePath - Path to the workspace (optional)
 * @returns {string} Full path to the created file
 */
export function writeToTmpFile(content, filename, extension = 'txt', encoding = 'utf8', workspacePath = null) {
	try {
		const tmpDir = ensureTmpDir(workspacePath);
		const timestamp = getTimestamp();
		const fullFilename = `${filename}_${timestamp}.${extension}`;
		const fullPath = path.join(tmpDir, fullFilename);

		fs.writeFileSync(fullPath, content, encoding);
		log(`File written to tmp directory: ${fullPath}`, 'debug');

		return fullPath;
	} catch (error) {
		log(`Error writing to tmp file: ${error.message}`, 'error');
		throw error;
	}
}

/**
 * Writes content to a temporary file asynchronously
 * @param {string} content - Content to write
 * @param {string} filename - Name of the file (without extension)
 * @param {string} extension - File extension (default: 'txt')
 * @param {string} encoding - File encoding (default: 'utf8')
 * @param {string} workspacePath - Path to the workspace (optional)
 * @returns {Promise<string>} Full path to the created file
 */
export async function writeToTmpFileAsync(content, filename, extension = 'txt', encoding = 'utf8', workspacePath = null) {
	try {
		const tmpDir = ensureTmpDir(workspacePath);
		const timestamp = getTimestamp();
		const fullFilename = `${filename}_${timestamp}.${extension}`;
		const fullPath = path.join(tmpDir, fullFilename);

		await fs.promises.writeFile(fullPath, content, encoding);
		log(`File written to tmp directory (async): ${fullPath}`, 'debug');

		return fullPath;
	} catch (error) {
		log(`Error writing to tmp file (async): ${error.message}`, 'error');
		throw error;
	}
}

/**
 * Returns predefined instructions for different agent types
 * @param {string} name - Name of the agent type
 * @returns {string} Instructions text
 */
export function getAgentInstructions(name) {
	switch (name) {
		case 'mcpServer':
			return `
# Checklist d'Instruccions (Agent IA)
- 🔑 Respon sempre en l'idioma de l'usuari.
- ✅ Segueix **sempre** les instruccions dels tools, sobretot les **IMPORTANT**.
- 🚫 No facis servir Salesforce CLI, només els tools (excepte si l'usuari ho diu).
- 📂 Fitxers temporals: només ./tmp/.
  - Crea la carpeta si no existeix.
  - Prohibit /tmp, os.tmpdir(), etc.
- 📊 Visuals: genera **PNG** i adjunta.
- 📋 Llistes: mostra-les en **taules Markdown**.
- 🔎 API Names: obtén-los amb describeObject. No els inventis.
- 🌐 Navegació web: obre directament. Salesforce → sempre amb **Chrome**.
- 👥 Person Accounts: no usis Name. Fes servir FirstName, LastName, en **UPPERCASE**, sense LIKE.
- 🤖 Agentforce: només si l'usuari ho demana. Mostra resposta exacta.
- 👤 User name → getOrgAndUserDetails.
- ⏰ Data/hora → getCurrentDatetime (salesforceMcpUtils).
- 📚 Schema → describeObject.
- 📝 SOQL:
  - Només camps i relacions del **schema donat**.
  - No inventar res.
  - Picklists → valors exactes, entre cometes.
  - Subqueries només si es demanen.
  - Si un camp no existeix → ERROR_INVALID_FIELD.
  - Sortida: només el bloc soql amb la query.
`;
		case 'generateSoqlQueryToolSampling':
			return `
You are an expert **Salesforce SOQL** developer.

## Context
You will receive **two** inputs:
1. A natural-language **description** of the query to build.
2. The **schema** of the relevant objects — including fields, relationships, record types and, when applicable, pick-list **Values**.

## Strict rules
1. Use **only** the fields, relationships (parent *and* child) and record types present in the supplied schema.
2. **NEVER** invent or rename any field, relationship or object.
3. It is allowed to use sub-queries (\`SELECT ... FROM ChildRelationship__r\`) **only** when the description explicitly requires child data.
4. When filtering by pick-list, use **one of the provided Values verbatim and wrap it in single quotes**.
5. If the description references something that does not exist in the schema, reply **exactly**: **ERROR_INVALID_FIELD**.
6. Do **not** include the schema or any explanations in the output. Return **only** the SOQL query.

## Ambiguity resolution
• Match by **API name first**.
• If the description uses a label, map it to the matching API name shown on the same line of the schema.

## Output format
Return a single fenced block labelled **\`soql\`** containing only the query, e.g.:

\`\`\`soql
SELECT Id FROM Account LIMIT 5
\`\`\`

No additional text before or after the block.

## Mandatory self-check
Before replying, verify that **every selected field, relationship and record type** exists in the schema **and** that pick-list comparisons use valid values.
If any check fails, respond with **ERROR_INVALID_FIELD** instead of a query.
`.trim();

		default:
			return '';
	}
}

/**
 * Generates a timestamp string
 * @param {boolean} long - Whether to use long format (DD-MM-YY, HH:MM:SS) instead of compact format (YYMMDDHHMMSS)
 * @returns {string} Formatted timestamp
 */
export function getTimestamp(long = false) {
	const now = new Date();
	const year = String(now.getFullYear()).slice(-2); //Get last 2 digits of year
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');
	if (long) {
		return `${day}-${month}-${year}, ${hours}:${minutes}:${seconds}`;
	} else {
		return `${year}${month}${day}${hours}${minutes}${seconds}`;
	}
}

/**
 * Generates a prefix for log messages with emoji based on log level
 * @param {string} logLevel - Log level (emergency, alert, critical, error, warning, notice, info, debug)
 * @returns {string} Formatted log prefix
 * @private
 */
function getLogPrefix(logLevel) {
	const logLevelEmojis = {
		emergency: '🔥', alert: '⛔️', critical: '❗️', error: '❌', warning: '⚠️', notice: '✉️', info: '💡', debug: '🐞'
	};

	const emoji = logLevelEmojis[logLevel] || '❓';
	const logLevelPrefix = emoji.repeat(3);

	if (config.logPrefix) {
		return `(${config.logPrefix} · ${logLevelPrefix})`;
	}
	return `(${logLevelPrefix})`;
}

/**
 * Extracts the file name without extension from a file path
 * @param {string} filePath - Path to the file
 * @returns {string} File name without extension
 */
export function getFileNameFromPath(filePath) {
	const trimmed = filePath.replace(/[\\\/]+$/, '');
	const ext = path.extname(trimmed);
	return ext ? path.basename(trimmed, ext) : path.basename(trimmed);
}

/**
 * Formats a date object to a localized string (includes time if date is today)
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
	let formattedDate = date.toLocaleDateString('es-ES', {day: 'numeric', month: 'numeric', year: 'numeric'});
	if (date.toDateString() === new Date().toDateString()) {
		formattedDate += ' ' + date.toLocaleTimeString('es-ES', {hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false});
	}
	return formattedDate;
}