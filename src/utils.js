import state from './state.js';
import {CONFIG} from './config.js';
//import {globalCache} from './cache.js';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {exec as execCallback} from 'child_process';
import {promisify} from 'util';
//import {runCliCommand} from './salesforceServices/runCliCommand.js';
import {getOrgAndUserDetails} from './salesforceServices/getOrgAndUserDetails.js';
import os from 'os';
import {executeSoqlQuery} from './salesforceServices/executeSoqlQuery.js';

const isWindows = os.platform() === 'win32';
//const __filename = fileURLToPath(import.meta.url);
//const __dirname = path.dirname(__filename);

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

	if (state.client.capabilities?.logging) {
		state.server.sendLoggingMessage(message, logLevel);
		//state.server.sendLoggingMessage({
		//level: logLevel,
		//logger: 'server',
		//data: {text: message}
		//});
	} else {
		console.error(message);
	}
}

async function validateUserPermissions(userId) {
	const query = await executeSoqlQuery(`SELECT Id FROM PermissionSetAssignment WHERE AssigneeId = '${userId}' AND PermissionSet.Name = 'IBM_SalesforceMcpUser'`);
	if (!query?.records?.length) {
		log(`${userId}, permisos insuficientes`, 'error');
		state.server.close();
		process.exit(1);
	}
}

export const initServer = async () => {
	try {
		if (isWindows) {
			await execPromise(`set HOME=${process.env.HOME}`);
		} else {
			await execPromise(`export HOME=${process.env.HOME}`);
		}
		const orgDescription = await getOrgAndUserDetails();
		log(`Server initialized and running. Target org: ${orgDescription.alias}`, 'debug');
		validateUserPermissions(orgDescription.user.id);

	} catch (error) {
		throw new Error(error.message);
	}
};

export function notifyProgressChange(progressToken, total, progress, message) {
	if (!progressToken) {
		return;
	}
	state.server.notification({
		method: 'notifications/progress',
		params: {progressToken, progress, total, message}
	});
}

export function loadToolDescription(toolName) {
	//Calcular __dirname localment dins la funció
	const localFilename = fileURLToPath(import.meta.url);
	const localDirname = path.dirname(localFilename);
	const mdPath = path.join(localDirname, 'tools', `${toolName}.md`);
	const b64Path = mdPath + '.b64';
	try {
		if (fs.existsSync(b64Path)) {
			const b64 = fs.readFileSync(b64Path, 'utf8');
			return Buffer.from(b64, 'base64').toString('utf8');
		} else {
			return fs.readFileSync(mdPath, 'utf8');
		}
	} catch (err) {
		return `No description found for tool: ${toolName}`;
	}
}

export async function sendElicitRequest(title, message) {
	if (state.client.capabilities?.elicitation) {
		const elicitationResult = await state.server.elicitInput({
			message,
			requestedSchema: {
				type: 'object',
				properties: {
					confirmation: {
						type: 'string',
						title,
						description: message,
						enum: ['Yes', 'No'],
						enumNames: [`✅ Deploy metadata to ${state.orgDescription.alias}`, '❌ Don\'t deploy']
					}
				},
				required: ['confirmation']
			}
		});
		return elicitationResult;
	}
}

export function saveToFile(object, filename) {
	const filePath = path.join(os.tmpdir(), `${filename}_${Date.now()}.json`);
	fs.writeFileSync(filePath, JSON.stringify(object, null, 2), 'utf8');
	log(`Object written to temporary file: ${filePath}`, 'debug');
}