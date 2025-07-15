import {executeSoqlQuery} from '../salesforceServices/executeSoqlQuery.js';
import {loadToolDescription, log} from '../utils.js';

export const executeSoqlQueryToolDefinition = {
	name: 'executeSoqlQuery',
	title: 'Execute SOQL Query',
	description: loadToolDescription('executeSoqlQueryTool'),
	inputSchema: {
		type: 'object',
		required: ['query'],
		properties: {
			query: {
				type: 'string',
				description: 'The SOQL query to execute'
			},
			useToolingApi: {
				type: 'boolean',
				description: 'Whether to use the Tooling API for the query (default: false)'
			}
		}
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
		if (!query) {
			throw new Error('Query is required');
		}

		const result = await executeSoqlQuery(query);
		return {
			content: [{
				type: 'text',
				text: `SOQL query returned ${result.totalSize} records: ${JSON.stringify(result.records, null, '\t')}`
			}],
			structuredContent: {
				records: result
			}
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