import {config} from './config.js';
//import {globalCache} from './cache.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {mcpServer} from './mcp-server.js';
import client from './client.js';
import {executeSoqlQuery} from './salesforceServices.js';
import state from './state.js';

export function log(data, logLevel = 'info') {
	const LOG_LEVEL_PRIORITY = {emergency: 0, alert: 1, critical: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7};

	const logLevelPriority = LOG_LEVEL_PRIORITY[logLevel];
	const currentLogLevelPriority = LOG_LEVEL_PRIORITY[config.currentLogLevel];
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

	if (client?.isVsCode && mcpServer?.isConnected()) {
		const logger = `${config.logPrefix ? config.logPrefix + ' ' : ''}MCP server`;
		mcpServer.server.sendLoggingMessage({level: logLevel, logger, data});
	} else {
		console.error(config.logPrefix + data);
	}
}

export async function validateUserPermissions(userId) {
	const query = await executeSoqlQuery(`SELECT Id FROM PermissionSetAssignment WHERE AssigneeId = '${userId}' AND PermissionSet.Name = 'IBM_SalesforceMcpUser'`);
	if (!query?.records?.length) {
		log(`Insuficient permissions in org "${state.org.alias}"`, 'error');
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
	fs.writeFileSync(filePath, JSON.stringify(object, null, 3), 'utf8');
	log(`Object written to temporary file: ${filePath}`, 'debug');
}


export function getAgentInstructions(name) {
	switch (name) {
		case 'mcpServer':
			return `You are an expert **Salesforce MCP server** developer.

USAGE:
Always follow the instructions in the tool description, specially the IMPORTANT instructions.`;

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