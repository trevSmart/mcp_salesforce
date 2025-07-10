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
import {executeSoqlQuery} from './salesforceServices/executeSoqlQuery.js';

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

	try {
		const orgAlias = JSON.parse(await runCliCommand('sf config get target-org --json'))?.result?.[0]?.value;
		if (orgAlias) {
			await getOrgAndUserDetails();

			//Verificar que state.orgDescription se ha inicializado correctamente
			if (!state.orgDescription || !state.orgDescription.user || !state.orgDescription.user.id) {
				log('Error: No se pudo obtener la información del usuario de Salesforce', 'error');
				return true; //Permitir que el servidor continúe sin verificar permisos
			}

			const query = await executeSoqlQuery(`SELECT Id FROM PermissionSetAssignment WHERE AssigneeId = '${state.orgDescription.user.id}' AND PermissionSet.Name = 'IBM_SalesforceMcpUser'`);
			return query?.records?.length; //true if user has permission set, false if not
		} else {
			log('No se encontró un org alias configurado. El servidor continuará sin verificar permisos.', 'warn');
			return true; //Permitir que el servidor continúe sin verificar permisos
		}

	} catch (error) {
		log(`Error al inicializar el servidor: ${error.message}`, 'error');
		return true; //Permitir que el servidor continúe a pesar del error
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

export function sendListRootsRequest() {
	const server = state.server;
	if (!server) {
		return;
	}
	server.listRoots()
	.then(rootsResult => {
		if (rootsResult && rootsResult.roots) {
			log('Available workspace roots:', rootsResult.roots, 'debug');
		}
	}).catch(error => log(`Error requesting workspace roots: ${error}`, 'error'));
}

/**
 * Loads the markdown description for a tool from src/tools/{toolName}.md
 * @param {string} toolName - The name of the tool (e.g. 'getRecord')
 * @returns {string} The markdown content, or a warning if not found
 */
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