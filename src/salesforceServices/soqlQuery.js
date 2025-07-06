import {salesforceState} from '../state.js';
import {runCliCommand} from './runCliCommand.js';
import {log} from '../utils.js';

/**
 * Executa una consulta SOQL a Salesforce i retorna el resultat
 * @param {string} query - Consulta SOQL a executar
 * @returns {Promise<Object>} - Resultat cru de la consulta
 */
export async function executeSoqlQuery(query) {
	if (!query || typeof query !== 'string') {
		throw new Error('La consulta SOQL (query) és obligatòria i ha de ser una string');
	}
	try {
		const command = `sf data query --query "${query}" -o "${salesforceState.orgDescription.alias}" --json`;
		log(`Executing SOQL query command: ${command}`);
		const response = await JSON.parse(await runCliCommand(command));
		if (response.status !== 0) {
			throw new Error(response.message || 'Error executant la consulta SOQL');
		}
		return response.result;
	} catch (error) {
		log('Error executing SOQL query:', JSON.stringify(error, null, 2));
		throw error;
	}
}