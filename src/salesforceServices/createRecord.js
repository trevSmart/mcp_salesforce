import {runCliCommand} from './runCliCommand.js';
import {log} from '../utils.js';

/**
 * Crea un registre de Salesforce per sObjectName i fields
 * @param {string} sObjectName - Nom de l'objecte Salesforce
 * @param {Object} fields - Objecte amb els camps i valors
 * @returns {Promise<Object>} - Resultat cru de la creació
 */
export async function createRecord(sObjectName, fields, useToolingApi = false) {
	if (!sObjectName || !fields || typeof fields !== 'object') {
		throw new Error('sObjectName i fields són obligatoris');
	}
	try {
		const valuesString = Object.entries(fields)
			.map(([key, value]) => `${key}='${String(value).replace(/'/g, '\\\'')}'`)
			.join(' ');
		const command = `sf data create record --sobject ${sObjectName} --values "${valuesString}" ${useToolingApi ? '--use-tooling-api' : ''} --json`;
		log(`Executing create record command: ${command}`, 'debug');
		const response = await JSON.parse(await runCliCommand(command));
		if (response.status !== 0) {
			throw new Error(response.message || 'Error creant el registre');
		}
		return response.result;
	} catch (error) {
		log(`Error creating record in object ${sObjectName}:`, JSON.stringify(error, null, 2));
		throw error;
	}
}