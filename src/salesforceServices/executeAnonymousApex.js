import {runCliCommand} from './runCliCommand.js';
import {log} from '../utils.js';
import fs from 'fs/promises';
import path from 'path';
import {randomUUID} from 'crypto';

/**
 * Executa codi Anonymous Apex a Salesforce
 * @param {string} apexCode - Codi Apex a executar
 * @returns {Promise<Object>} - Resultat de l'execució (inclou debug)
 */
export async function executeAnonymousApex(apexCode) {
	if (!apexCode || typeof apexCode !== 'string') {
		throw new Error('apexCode és obligatori i ha de ser una string');
	}
	const tmpDir = path.join(process.cwd(), 'tmp');
	let tmpFile;
	let tmpOutFile;
	try {
		//Assegura que la carpeta tmp existeix
		await fs.mkdir(tmpDir, {recursive: true});
		tmpFile = path.join(tmpDir, `anonymousApex_${randomUUID()}.apex`);
		tmpOutFile = path.join(tmpDir, `anonymousApex_${randomUUID()}.json`);
		//Escriu el codi Apex al fitxer temporal
		await fs.writeFile(tmpFile, apexCode, 'utf8');
		const command = `sf apex run --file "${tmpFile}" --json > "${tmpOutFile}"`;
		log(`Executing anonymous Apex: ${command}`, 'debug');
		let cliError = null;
		try {
			await runCliCommand(command); //Ja no cal capturar la sortida aquí
		} catch (cliErr) {
			cliError = cliErr;
		}

		let output = null;
		let response = null;
		let outputReadError = null;

		try {
			output = await fs.readFile(tmpOutFile, 'utf8');
			response = JSON.parse(output);

		} catch (readErr) {
			outputReadError = readErr;
		}

		let errorMsg = '';
		if (cliError || outputReadError || !response || response.status !== 0) {
			if (cliError) {
				errorMsg += `${cliError.message || cliError}`;
				if (cliError.stderr) {
					errorMsg += `\nCLI stderr: ${cliError.stderr}`;
				}
			}
			if (outputReadError) {
				errorMsg += `Error reading output file: ${outputReadError.message}`;
			}
			if (output) {
				errorMsg += `Output file content: ${output}`;
			}
			if (response && response.message) {
				errorMsg += `Salesforce error: ${response.message}`;
			}
			log(errorMsg, 'error');
			throw new Error(errorMsg);
		}
		log(response, 'debug');
		return response.result;

	} catch (error) {
		log(`Error executing anonymous Apex: ${JSON.stringify(error, null, 2)}`, 'error');
		throw error;

	} finally {
		//Elimina els fitxers temporals
		if (tmpFile) {
			try {
				await fs.unlink(tmpFile);
			} catch (e) {
				//No passa res si no es pot eliminar
			}
		}
		if (tmpOutFile) {
			try {
				await fs.unlink(tmpOutFile);
			} catch (e) {
				//No passa res si no es pot eliminar
			}
		}
	}
}