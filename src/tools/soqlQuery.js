import {getOrgDescription} from '../../index.js';
import {runCliCommand, log} from '../utils.js';

async function executeSoqlQuery({query, useToolingApi = false}) {
	try {
		const toolingFlag = useToolingApi ? '--use-tooling-api' : '';

		//Clean the query by replacing line breaks and tabs with spaces
		let cleanQuery = query.replace(/[\n\t\r]+/g, ' ').trim();

		//Si la query és una SELECT, afegeix Id si no hi és present
		const selectMatch = cleanQuery.match(/^select\s+(.+?)\s+from\s+/i);
		if (selectMatch) {
			let fields = selectMatch[1].split(',').map(f => f.trim());
			const hasId = fields.some(f => f.toLowerCase() === 'id');
			if (!hasId) {
				fields = ['Id', ...fields];
				cleanQuery = cleanQuery.replace(/^select\s+(.+?)\s+from\s+/i, `SELECT ${fields.join(', ')} FROM `);
			}
		}

		const command = `sf data query --query "${cleanQuery.replace(/"/g, '\\"')}" -o ${getOrgDescription().alias} ${toolingFlag} --json`;
		log(`Executing SOQL query command: ${command}`);
		const response = await JSON.parse(await runCliCommand(command));
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
		log('Error in executeSoqlQuery:', error);
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `Error executing SOQL query: ${error.message}`
			}]
		};
	}
}

export default executeSoqlQuery;