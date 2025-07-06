import {runCliCommand} from './runCliCommand.js';
import {log} from '../utils.js';

/**
 * Obté un registre de Salesforce per sObjectName i recordId
 * @param {string} sObjectName - Nom de l'objecte Salesforce
 * @param {string} recordId - Id del registre
 * @returns {Promise<Object>} - Resultat cru de la consulta
 */
export async function getRecordById(sObjectName, recordId) {
	if (!sObjectName || !recordId) {
		throw new Error('sObjectName i recordId són obligatoris');
	}
	try {
		const command = `sf data get record --sobject ${sObjectName} --record-id ${recordId} --json`;
		log(`Executing get record command: ${command}`);
		const response = await JSON.parse(await runCliCommand(command));
		if (response.status !== 0) {
			throw new Error(response.message || 'Error obtenint el registre');
		}
		return response.result;
	} catch (error) {
		log(`Error getting record ${recordId} from object ${sObjectName}:`, JSON.stringify(error, null, 2));
		throw error;
	}
}