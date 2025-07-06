import {runCliCommand} from './runCliCommand.js';
import {log} from '../utils.js';

/**
 * Obté la descripció d'un SObject de Salesforce via CLI
 * @param {string} sObjectName - Nom de l'objecte Salesforce
 * @returns {Promise<Object>} - Resultat cru de la descripció
 */
export async function describeObject(sObjectName) {
	if (!sObjectName || typeof sObjectName !== 'string') {
		throw new Error('sObjectName és obligatori i ha de ser una string');
	}
	try {
		const command = `sf sobject describe --sobject ${sObjectName} --json`;
		log(`Executing describe object command: ${command}`);
		const response = await JSON.parse(await runCliCommand(command));
		return response;
	} catch (error) {
		log(`Error describing object ${sObjectName}:`, JSON.stringify(error, null, 2));
		throw error;
	}
}