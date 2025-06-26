import {salesforceState} from '../state.js';
import {runCliCommand, log} from '../utils.js';

async function executeSoqlQuery({query, useToolingApi = false}) {
	try {
		const cleanQuery = query.replace(/\s+/g, ' ').trim();
		const toolingFlag = useToolingApi ? '-t' : '';

		//If the query is a SELECT, add Id if not present
		const selectMatch = cleanQuery.match(/^select\s+(.+?)\s+from\s+/i);
		if (selectMatch) {
			let fields = selectMatch[1].split(',').map(f => f.trim());
			const hasId = fields.some(f => f.toLowerCase() === 'id');
			if (!hasId) {
				fields = ['Id', ...fields];
				cleanQuery = cleanQuery.replace(/^select\s+(.+?)\s+from\s+/i, `SELECT ${fields.join(', ')} FROM `);
			}
		}

		const command = `sf data query --query "${cleanQuery.replace(/"/g, '\\"')}" -o "${salesforceState.orgDescription.alias}" ${toolingFlag} --json`;
		log(`Executing SOQL query command: ${command}`);
		const response = await JSON.parse(await runCliCommand(command));

		const records = response.result.records.map(r => ({...r, href: `https://${salesforceState.orgDescription.instanceUrl}.lightning.force.com/${r.Id}`}));
		response.result.records = records;

		if (response.status !== 0) {
			return {
				isError: true,
				content: [{
					type: 'text',
					text: `Error executing SOQL query: ${response.error}`
				}]
			};
		}

		return {
			content: [{
				type: 'text',
				text: `✅ SOQL query executed successfully. Returned ${records.length} records.`
			}],
			structuredContent: {
				records: records
			}
		};

	} catch (error) {
		log('Error in executeSoqlQuery:', error);
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export default executeSoqlQuery;