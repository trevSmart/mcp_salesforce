import {executeSoqlQuery} from '../salesforceServices.js';
import {log, textFileContent} from '../utils.js';
import {z} from 'zod';

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
		const result = await executeSoqlQuery(query, useToolingApi);
		return {
			content: [{
				type: 'text',
				text: `SOQL query returned the following ${result.totalSize} records: ${JSON.stringify(result.records, null, '3')}`
			}],
			structuredContent: result
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