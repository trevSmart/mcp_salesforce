import {log} from '../utils.js';
import {CONFIG} from '../config.js';
import {exec as execCallback} from 'child_process';
import {promisify} from 'util';

const execPromise = promisify(execCallback);

/**
 * Executa una comanda de Salesforce CLI i retorna la sortida (stdout)
 * @param {string} command - Comanda a executar
 * @returns {Promise<string>} - Sortida de la comanda
 */
export async function runCliCommand(command) {
	try {
		log(`Running SF CLI command: ${command}`, 'debug');
		const {stdout} = await execPromise(command, {maxBuffer: 100 * 1024 * 1024, cwd: CONFIG.workspacePath});
		log(`SF CLI command output: ${stdout}`, 'debug');

		return stdout;

	} catch (error) {
		if (error.stdout) {
			return error.stdout;
		}
		log('Error running SF CLI command:', 'error');
		log(error, 'error');
		throw error;
	}
}