import config from './config.js';
import fs from 'fs';
import state from './state.js';
import path from 'path';
import {fileURLToPath} from 'url';
import {createModuleLogger} from './lib/logger.js';
const logger = createModuleLogger(import.meta.url);

// Avoid static import of salesforceServices to prevent ESM cycles during module init
let _executeSoqlQuery = null;
async function __getExecuteSoqlQuery() {
	if (!_executeSoqlQuery) {
		try {
			const mod = await import('./lib/salesforceServices.js');
			_executeSoqlQuery = mod.executeSoqlQuery;
		} catch {
			_executeSoqlQuery = null;
		}
	}
	return _executeSoqlQuery;
}
import {getAgentInstructions as _getAgentInstructions} from './instructions.js';

/**
 * Validates if the user has the required permissions
 * @param {string} username - The username to validate
 * @returns {Promise<void>}
 */
export async function validateUserPermissions(username) {
	try {
		if (typeof username !== 'string' || !username.trim()) {
			throw new Error('Invalid username parameter');
		}
		// Escape backslashes first, then single quotes for SOQL string literals
		const safeUsername = username.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
		const soql = `SELECT Id FROM PermissionSetAssignment WHERE Assignee.Username = '${safeUsername}' AND PermissionSet.Name = 'IBM_SalesforceMcpUser'`;
		const execSoql = await __getExecuteSoqlQuery();
		const query = execSoql ? await execSoql(soql) : null;
		if (query?.records?.length) {
			state.userValidated = true;
		} else {
			state.userValidated = false;
			// Keep emergency level for visibility via base sink
			logger.emergency(`Insufficient permissions in org "${state.org.alias}". Assign Permission Set 'IBM_SalesforceMcpUser' to the user.`);
		}
	} catch (error) {
		state.userValidated = false;
		logger.error(error, 'Error validating user permissions');
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
 * Reads text content from a file with flexible lookup rules.
 * - If input contains a path separator, it is treated as a path relative to src/ (this file's folder),
 *   with automatic fallback to a '.pam' variant when the original file doesn't exist (useful after packaging).
 * - If input does not contain a path separator, it is treated as a tool descriptor name and looked up under src/tools.
 * - If the found file content looks base64, it is decoded automatically.
 * @param {string} input - Tool name (legacy) or relative/absolute path to a file (without or with extension).
 * @returns {string|null} Content of the file or null if not found
 */
export function textFileContent(input) {
	try {
		const localFilename = fileURLToPath(import.meta.url);
		const localDirname = path.dirname(localFilename);

		const tryRead = (fullPath) => {
			if (!fullPath || !fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
				return null;
			}
			const content = fs.readFileSync(fullPath, 'utf8');
			const trimmed = content.trim();
			// Detect base64 payloads (used in publish step for .md/.apex → .pam)
			const isBase64 = /^[A-Za-z0-9+/\r\n]*={0,2}$/.test(trimmed) && trimmed.length > 0;
			return isBase64 ? Buffer.from(trimmed, 'base64').toString('utf8') : content;
		};

		const looksLikePath = input.includes('/') || input.includes('\\');

		// Case A: explicit path lookup
		if (looksLikePath) {
			const basePath = path.isAbsolute(input) ? input : path.join(localDirname, input);

			// 1) Exact path
			let content = tryRead(basePath);
			if (content !== null) {
				return content;
			}

			// 2) Try ".pam" sibling (for packaged artifacts)
			content = tryRead(basePath + '.pam');
			if (content !== null) {
				return content;
			}

			// 3) Try prefix match inside the same directory (e.g., basename.*)
			const dir = path.dirname(basePath);
			const base = path.basename(basePath);
			if (fs.existsSync(dir)) {
				const entry = (fs.readdirSync(dir) || []).find(f => f.startsWith(base + '.'));
				if (entry) {
					content = tryRead(path.join(dir, entry));
					if (content !== null) {
						return content;
					}
				}
			}

			return null;
		}

		// Case B: legacy tool descriptor lookup under src/tools
		const toolsDir = path.join(localDirname, 'tools');
		if (!fs.existsSync(toolsDir)) {
			return null;
		}
		const files = fs.readdirSync(toolsDir);
		const candidates = files.filter(file => file.startsWith(input + '.'));
		if (!candidates.length) {
			return null;
		}

		// Prefer Markdown descriptions over JS when both exist
		const preferredOrder = [
			`${input}.md`,
			`${input}.md.pam`,
			`${input}.pam`,
			`${input}.apex`,
			`${input}.js`
		];
		let chosen = candidates.find(f => preferredOrder.includes(f));
		if (!chosen) {
			// Fallback to the first candidate (stable behavior)
			chosen = candidates[0];
		}
		return tryRead(path.join(toolsDir, chosen));

	} catch (error) {
		logger.debug(error, 'textFileContent error');
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
		workspacePath = `${process.cwd()}/tmp`
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
				logger.debug(`Created directory: ${dir}`);
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
				logger.debug(`File written to: ${fullPath}`);
				return fullPath;
			}).catch(error => {
				logger.error(`Error writing to file: ${error.message}`);
				throw error;
			});
		} else {
			fs.writeFileSync(fullPath, content, encoding);
			logger.debug(`File written to: ${fullPath}`);
			return fullPath;
		}

	} catch (error) {
		logger.error(`Error writing to file: ${error.message}`);
		throw error;
	}
}

/**
 * Saves an object to a temporary JSON file
 * @param {object} object - Object to save
 * @param {string} filename - Base name for the file (without extension)
 */
export function saveToFile(object, filename) {
	const filePath = path.join(state.tempPath, `${filename}_${Date.now()}.json`);
	fs.writeFileSync(filePath, JSON.stringify(object, null, 3), 'utf8');
	logger.debug(`Object written to temporary file: ${filePath}`);
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
		logger.debug(`Created tmp directory: ${tmpDir}`);
	}

	return tmpDir;
}

/**
 * Writes content to a temporary file in the workspace tmp directory
 * @param {string} content - Content to write
 * @param {string} filename - Name of the file (with extension)
 * @param {string} encoding - File encoding (default: 'utf8')
 * @param {string} workspacePath - Path to the workspace (optional)
 * @returns {string} Full path to the created file
 */
export function writeToTmpFile(content, filename, encoding = 'utf8', workspacePath = null) {
	try {
		const tmpDir = ensureTmpDir(workspacePath);
		const fullPath = path.join(tmpDir, filename);

		fs.writeFileSync(fullPath, content, encoding);
		logger.debug(`File written to tmp directory: ${fullPath}`);

		return fullPath;
	} catch (error) {
		logger.error(`Error writing to tmp file: ${error.message}`);
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
		logger.debug(`File written to tmp directory (async): ${fullPath}`);

		return fullPath;
	} catch (error) {
		logger.error(`Error writing to tmp file (async): ${error.message}`);
		throw error;
	}
}

/**
 * Returns predefined instructions for different agent types
 * @param {string} name - Name of the agent type
 * @returns {string} Instructions text
 */
export function getAgentInstructions(name) {
	return _getAgentInstructions(name);
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
// getLogPrefix removed; handled centrally in logger.js

/**
 * Extracts the file name without extension from a file path
 * @param {string} filePath - Path to the file
 * @returns {string} File name without extension
 */
export function getFileNameFromPath(filePath) {
	const trimmed = filePath.replace(/[\\/]+$/, '');
	const ext = path.extname(trimmed);
	return ext ? path.basename(trimmed, ext) : path.basename(trimmed);
}

/**
 * Formats a date object to a localized string (includes time if date is today)
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
	// Use configured locale if provided; otherwise rely on system default locale
	let locale = (typeof config?.locale === 'string' && config.locale.trim()) ? config.locale.trim() : undefined;

	const timeOptions = {hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false};
	const dateOptions = {day: 'numeric', month: 'numeric', year: 'numeric'};

	const safeFormat = (d, method, opts) => {
		try {
			return d[method](locale, opts);
		} catch {
			// Fallback to system default locale if provided locale is invalid
			return d[method](undefined, opts);
		}
	};

	let formattedDate = safeFormat(date, 'toLocaleTimeString', timeOptions);
	if (date.toDateString() !== new Date().toDateString()) {
		formattedDate = safeFormat(date, 'toLocaleDateString', dateOptions) + ' ' + formattedDate;
	}
	return formattedDate;
}
