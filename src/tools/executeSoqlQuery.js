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
	description: textFileContent('executeSoqlQuery'),
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

export async function executeSoqlQueryToolHandler({query, useToolingApi = false}) {
	try {
		let queryResult = await executeSoqlQuery(query, useToolingApi);

		// Validate response structure
		if (!queryResult || typeof queryResult !== 'object') {
			throw new Error('Invalid response structure from Salesforce API');
		}

		// Ensure records array exists
		if (!queryResult.records || !Array.isArray(queryResult.records)) {
			throw new Error('No records found in query response');
		}

		// Add URLs to all records and related records
		queryResult.records = queryResult.records.map(r => addUrlToRecord({...r}));

		// Build response message
		const totalSize = queryResult.totalSize || queryResult.records.length;
		const message = `SOQL query executed successfully. Returned ${totalSize} record${totalSize !== 1 ? 's' : ''}.`;

		// If there are many records, provide a summary instead of full JSON
		// eslint-disable-next-line no-unused-vars
		const displayRecords = totalSize > 10 ?
			queryResult.records.slice(0, 10) :
			queryResult.records;

		// eslint-disable-next-line no-unused-vars
		const displayText = totalSize > 10 ?
			`${message} Showing first 10 records (${totalSize - 10} more available in structuredContent):` :
			`${message} All records:`;

		return {
			content: [{
				type: 'text',
				text: `${totalSize} records returned`
			}],
			structuredContent: queryResult
		};

	} catch (error) {
		log(error, 'error');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error executing SOQL query: ${error.message}`
			}]
		};
	}
}