import {soqlQuerySchema, useToolingApiSchema} from './paramSchemas.js';
import {z} from 'zod';
import {executeSoqlQuery} from '../salesforceServices/executeSoqlQuery.js';
import {loadToolDescription} from '../utils.js';

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
	const schema = z.object({
		query: soqlQuerySchema,
		useToolingApi: useToolingApiSchema,
	});
	const parseResult = schema.safeParse({query, useToolingApi});
	if (!parseResult.success) {
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error de validació: ${parseResult.error.message}`
			}]
		};
	}

	try {
		const result = await executeSoqlQuery(query);
		return {
			content: [{
				type: 'text',
				text: `✅ SOQL query executed successfully. Returned ${result.records.length} records.`
			}],
			structuredContent: {
				records: result.records
			}
		};
	} catch (error) {
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}