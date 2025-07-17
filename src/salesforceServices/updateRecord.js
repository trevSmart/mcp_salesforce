import {runCliCommand} from './runCliCommand.js';
import {log} from '../utils.js';

/**
 * Actualitza un registre de Salesforce per sObjectName, recordId i fields
 * @param {string} sObjectName - Nom de l'objecte Salesforce
 * @param {string} recordId - Id del registre
 * @param {Object} fields - Objecte amb els camps i valors
 * @returns {Promise<Object>} - Resultat cru de l'actualització
 */
export async function updateRecord(sObjectName, recordId, fields, useToolingApi = false) {
	if (!sObjectName || !recordId || !fields || typeof fields !== 'object') {
		throw new Error('sObjectName, recordId i fields són obligatoris');
	}
	try {
		const valuesString = Object.entries(fields)
			.map(([key, value]) => `${key}='${String(value).replace(/'/g, '\\\'')}'`)
			.join(' ');
		const command = `sf data update record --sobject ${sObjectName} --record-id ${recordId} --values "${valuesString}" ${useToolingApi ? '--use-tooling-api' : ''} --json`;
		log(`Executing update record command: ${command}`);
		const response = await JSON.parse(await runCliCommand(command));
		if (response.status !== 0) {
			throw new Error(response.message || 'Error actualitzant el registre');
		}
		return response.result;
	} catch (error) {
		log(`Error updating record ${recordId} in object ${sObjectName}:`, JSON.stringify(error, null, 2));
		throw error;
	}
}