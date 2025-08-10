import state from '../state.js';
import {executeSoqlQuery} from '../salesforceServices.js';
import {log, textFileContent} from '../utils.js';
import {z} from 'zod';

//Recursive function to add url properties to all records and related records
function addUrlToRecord(record) {
	if (!record || typeof record !== 'object') {
		return record;
	}

	//Add url to the main record if it has an Id
	if (record.Id) {
		record.url = `https://${state.org.instanceUrl}/${record.Id}`;
	}

	//Recursively process all properties that might contain related records
	for (const [key, value] of Object.entries(record)) {
		if (key === 'attributes') {
			continue; //Skip attributes object
		}

		if (value && typeof value === 'object') {
			if (Array.isArray(value)) {
				//Handle arrays of related records
				record[key] = value.map(item => addUrlToRecord(item));
			} else {
				//Handle single related record
				record[key] = addUrlToRecord(value);
			}
		}
	}

	return record;
}

export const executeSoqlQueryToolDefinition = {
	name: 'executeSoqlQuery',
	title: 'Execute SOQL Query',
	description: textFileContent('executeSoqlQueryTool'),
	inputSchema: {
		query: z
			.string()
			.describe('The SOQL query to execute'),
		useToolingApi: z
			.boolean()
			.optional()
			.default(false)
			.describe('Whether to use the Tooling API for the query (default: false)')
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Execute SOQL Query'
	}
};

export async function executeSoqlQueryTool({query, useToolingApi = false}) {
	try {
		let queryResult = await executeSoqlQuery(query, useToolingApi);
		queryResult.records = queryResult.records.map(r => addUrlToRecord({...r}));

		return {
			content: [{
				type: 'text',
				text: `SOQL query returned the following ${queryResult.totalSize} records: ${JSON.stringify(queryResult.records, null, 3)}`
			}],
			structuredContent: queryResult
		};

	} catch (error) {
		log(error, 'error');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}