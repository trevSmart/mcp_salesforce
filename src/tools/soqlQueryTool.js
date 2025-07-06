import {soqlQuerySchema, useToolingApiSchema} from './paramSchemas.js';
import {z} from 'zod';
import {executeSoqlQuery} from '../salesforceServices/soqlQuery.js';

export default async function executeSoqlQueryTool({query, useToolingApi = false}) {
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