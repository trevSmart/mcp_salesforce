import state from './state.js';
import {CONFIG} from './config.js';
//import {globalCache} from './cache.js';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {exec as execCallback} from 'child_process';
import {promisify} from 'util';
import {runCliCommand} from './salesforceServices/runCliCommand.js';
import {getOrgAndUserDetails} from './salesforceServices/getOrgAndUserDetails.js';
import os from 'os';

const isWindows = os.platform() === 'win32';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = promisify(execCallback);

export function log(message, logLevel = 'info') {
	const LOG_LEVEL_PRIORITY = {info: 0, debug: 1, warn: 2, error: 3};

	if (LOG_LEVEL_PRIORITY[logLevel] < LOG_LEVEL_PRIORITY[CONFIG.currentLogLevel]) {
		return;
	}

	//if (typeof message === 'object') {
	//message = JSON.stringify(message, null, 2);
	//}
	if (CONFIG.logPrefix) {
		message = `${CONFIG.logPrefix} ${message}`;
	}
	if (message.length > 1000) {
		message = message.slice(0, 1000) + '...';
	}
	console.error(message);
}

export const initServer = async () => {
	if (isWindows) {
		await execPromise(`set HOME=${process.env.HOME}`);
	} else {
		await execPromise(`export HOME=${process.env.HOME}`);
	}
	const orgAlias = JSON.parse(await runCliCommand('sf config get target-org --json'))?.result?.[0]?.value;
	if (orgAlias) {
		await getOrgAndUserDetails();

		/*
		//SF CLI update every week
		const lastSfCliUpdate = globalCache.get(orgDescription.alias, 'maintenance', 'sfCliUpdateLastRunDate');
		if (
			lastSfCliUpdate && now - lastSfCliUpdate > globalCache.EXPIRATION_TIME.UPDATE_SF_CLI ||
			!lastSfCliUpdate && Math.random() < 0.1
		) {
			log('Launching sf update...');
			setTimeout(() => runCliCommand('sf update'), 0); //immediate
			globalCache.set(orgDescription.alias, 'maintenance', 'sfCliUpdateLastRunDate', now);
		} else if (!lastSfCliUpdate) {
			log('No last SF CLI update date and not selected by probability.');
		} else {
			log('No need to update SF CLI, last update was less than a week ago.');
		}
		*/
	}
};

export function notifyProgressChange(progressToken, total, progress, message) {
	if (!progressToken) {
		return;
	}
	const server = state.server;
	server && server.notification({
		method: 'notifications/progress',
		params: {
			progressToken,
			progress,
			total,
			message
		}
	});
}

/**
 * Loads the markdown description for a tool from src/tools/{toolName}.md
 * @param {string} toolName - The name of the tool (e.g. 'getRecord')
 * @returns {string} The markdown content, or a warning if not found
 */
export function loadToolDescription(toolName) {
	const mdPath = path.join(__dirname, 'tools', `${toolName}.md`);
	try {
		return fs.readFileSync(mdPath, 'utf8');
	} catch (err) {
		return `No description found for tool: ${toolName}`;
	}
}