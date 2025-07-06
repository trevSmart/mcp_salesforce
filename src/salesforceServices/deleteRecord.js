import {salesforceState} from '../state.js';
import {runCliCommand} from './runCliCommand.js';
import {log} from '../utils.js';

/**
 * Elimina un registre de Salesforce per sObjectName i recordId
 * @param {string} sObjectName - Nom de l'objecte Salesforce
 * @param {string} recordId - Id del registre
 * @returns {Promise<Object>} - Resultat cru de l'eliminació
 */
export async function deleteRecord(sObjectName, recordId) {
	if (!sObjectName || !recordId) {
		throw new Error('sObjectName i recordId són obligatoris');
	}
	try {
		const command = `sf data delete record --sobject ${sObjectName} --record-id ${recordId} -o "${salesforceState.orgDescription.alias}" --json`;
		log(`Executing delete record command: ${command}`);
		const response = await JSON.parse(await runCliCommand(command));
		if (response.status !== 0) {
			throw new Error(response.message || 'Error eliminant el registre');
		}
		return response.result;
	} catch (error) {
		log(`Error deleting record ${recordId} from object ${sObjectName}:`, JSON.stringify(error, null, 2));
		throw error;
	}
}