/*globals process */
import { getOrgDescription } from '../index.js';
import {runCliCommand} from './utils.js';

async function soqlQuery({query, useToolingApi = false}) {
	try {
		const toolingFlag = useToolingApi ? '--use-tooling-api' : '';

		//Netegem la query substituint salts de línia i tabulacions per espais
		const cleanQuery = query.replace(/[\n\t\r]+/g, ' ').trim();

		const command = `sf data query --query "${cleanQuery.replace(/"/g, '\\"')}" -o ${getOrgDescription().alias} ${toolingFlag} --json`;
		console.error(`Executing SOQL query command: ${command}`);
		const response = await runCliCommand(command);
		const records = response.result.records.map(r => ({...r, href: `https://${getOrgDescription().instanceUrl}.lightning.force.com/${r.Id}`}));
		return {
			content: [
			{
				type: 'text',
				text: 'Present the results of the SOQL query in markdown format.'
			},
			{
				type: 'text',
				text: JSON.stringify(records, null, '\t')
			}]
		};

	} catch (error) {
		console.error('Error in soqlQuery:', error);
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `Error executing SOQL query: ${error.message}`
			}]
		};
	}
}

export {soqlQuery};