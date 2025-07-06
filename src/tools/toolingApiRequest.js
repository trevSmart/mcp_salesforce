import {log, loadToolDescription} from '../utils.js';
import {callSalesforceApi} from '../salesforceServices/callSalesforceApi.js';
import {globalCache} from '../cache.js';

export const toolingApiRequestToolDefinition = {
	name: 'toolingApiRequest',
	title: 'Tooling API Request',
	description: loadToolDescription('toolingApiRequest'),
	inputSchema: {
		type: 'object',
		required: ['method', 'endpoint'],
		properties: {
			method: {
				type: 'string',
				description: 'The HTTP method to use (GET, POST, PUT, DELETE)'
			},
			endpoint: {
				type: 'string',
				description: 'The endpoint to request (e.g. "/tooling/query/?q=SELECT+Name+FROM+ApexClass+LIMIT+10")'
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Tooling API Request'
	}
};

export async function toolingApiRequestTool({method, endpoint}) {
	try {
		const toolingEndpoint = endpoint.startsWith('/tooling')
			? endpoint
			: `/tooling${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

		//Only cache GET requests (do not modify data)
		if (method.toUpperCase() === 'GET') {
			const cached = globalCache.get('toolingApiRequest', toolingEndpoint);
			if (cached) {
				return cached;
			}

			const result = await callSalesforceApi(
				method,
				null,
				toolingEndpoint
			);

			const response = {
				content: [
					{
						type: 'text',
						text: JSON.stringify(result, null, 2)
					}
				],
				structuredContent: result
			};

			//Only store in cache if there is no error
			if (!result || result.isError || result.error) {
				return response;
			}
			globalCache.set('toolingApiRequest', toolingEndpoint, response);
			return response;
		} else {
			//For POST/PUT/DELETE do not cache
			const result = await callSalesforceApi(
				method,
				null,
				toolingEndpoint
			);

			log(`Tooling API request result: ${JSON.stringify(result, null, 2)}`, 'debug');

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(result, null, 2)
					}
				],
				structuredContent: result
			};
		}
	} catch (error) {
		return {
			isError: true,
			content: [
				{
					type: 'text',
					text: `Error in calling Salesforce Tooling API (${method} ${endpoint}): ${error.message}`
				}
			]
		};
	}
}