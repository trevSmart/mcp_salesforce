import {CONFIG} from './config.js';
//import {globalCache} from './cache.js';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import os from 'os';
import {executeSoqlQuery} from './salesforceServices.js';
import {mcpServer} from './mcp-server.js';

export function log(data, logLevel = 'info') {
	const LOG_LEVEL_PRIORITY = {emergency: 0, alert: 1, critical: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7};

	const logLevelPriority = LOG_LEVEL_PRIORITY[logLevel];
	const currentLogLevelPriority = LOG_LEVEL_PRIORITY[CONFIG.currentLogLevel];
	if (logLevelPriority > currentLogLevelPriority) {
		return;
	}

	if (typeof data === 'object') {
		data = JSON.stringify(data);
	}
	if (typeof data === 'string') {
		if (data.length > 4000) {
			data = data.slice(0, 3997) + '...';
		}
		data = '\n' + data + '\n';
	}

	if (mcpServer.isConnected()) {
		const logger = `${CONFIG.logPrefix ? CONFIG.logPrefix + ' ' : ''}MCP server`;
		mcpServer.server.sendLoggingMessage({level: logLevel, logger, data});
	} else {
		console.error(CONFIG.logPrefix + data);
	}
}

export async function validateUserPermissions(userId) {
	const query = await executeSoqlQuery(`SELECT Id FROM PermissionSetAssignment WHERE AssigneeId = '${userId}' AND PermissionSet.Name = 'IBM_SalesforceMcpUser'`);
	if (!query?.records?.length) {
		log(`${userId}, permisos insuficientes`, 'error');
		mcpServer.server.close();
		process.exit(1);
	}
}

export function notifyProgressChange(progressToken, total, progress, message) {
	if (!progressToken) {
		return;
	}
	mcpServer.server.notification({
		method: 'notifications/progress',
		params: {progressToken, progress, total, message}
	});
}

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

	} catch (err) {
		return null;
	}
}

export function saveToFile(object, filename) {
	const filePath = path.join(os.tmpdir(), `${filename}_${Date.now()}.json`);
	fs.writeFileSync(filePath, JSON.stringify(object, null, 2), 'utf8');
	log(`Object written to temporary file: ${filePath}`, 'debug');
}