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
	try {
		//Assegura que la carpeta tmp existeix
		await fs.mkdir(tmpDir, {recursive: true});
		tmpFile = path.join(tmpDir, `anonymousApex_${randomUUID()}.apex`);
		//Escriu el codi Apex al fitxer temporal
		await fs.writeFile(tmpFile, apexCode, 'utf8');
		const command = `sf apex run --file "${tmpFile}" --json`;
		log(`Executing anonymous Apex: ${command}`);
		const response = await JSON.parse(await runCliCommand(command));
		if (response.status !== 0) {
			throw new Error(response.message || 'Error executant anonymous Apex');
		}
		return response.result;
	} catch (error) {
		log('Error executing anonymous Apex:', JSON.stringify(error, null, 2));
		throw error;
	} finally {
		//Elimina el fitxer temporal
		if (tmpFile) {
			try {
				await fs.unlink(tmpFile);
			} catch (e) {
				//No passa res si no es pot eliminar
			}
		}
	}
}