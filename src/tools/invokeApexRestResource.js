import {textFileContent} from '../utils.js';
import {createModuleLogger} from '../lib/logger.js';
import {z} from 'zod';
import {callSalesforceApi} from '../lib/salesforceServices.js';
import state from '../state.js';

const logger = createModuleLogger(import.meta.url);

export const invokeApexRestResourceToolDefinition = {
	name: 'invokeApexRestResource',
	title: 'Invoke Apex REST Resource',
	description: textFileContent('tools/invokeApexRestResource.md'),
	inputSchema: {
		apexRestResource: z.string()
			.describe('The Apex REST Resource class name (e.g., "CSBD_WS_AltaOportunidad")'),
		operation: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
			.describe('The HTTP operation to perform'),
		body: z.union([z.string(), z.record(z.any())])
			.optional()
			.describe('The request body for POST/PUT/PATCH operations (JSON string or object)'),
		urlParams: z.record(z.any())
			.optional()
			.describe('URL parameters to append to the endpoint (object)'),
		headers: z.record(z.string())
			.optional()
			.describe('Additional headers to include in the request (object)')
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Invoke Apex REST Resource'
	}
};


export async function invokeApexRestResourceToolHandler({apexRestResource, operation, body, urlParams, headers}) {
	// Process request body first (outside try block so it's available in catch)
	let processedBody = null;

	if (body) {
		if (typeof body === 'string') {
			try {
				// Validate it's valid JSON, then pass the string directly
				JSON.parse(body);
				processedBody = body;
			} catch (error) {
				throw new Error(`Invalid JSON in body: ${error.message}`);
			}
		} else if (typeof body === 'object') {
			processedBody = body;
		}
	}

	try {
		// Validate required parameters
		if (!apexRestResource?.trim() || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(operation?.trim())) {
			throw new Error('Missing or invalid Apex REST Resource name or operation');
		}

		// Check if we have authentication
		if (!state?.org?.instanceUrl || !state?.org?.accessToken) {
			throw new Error('Not authenticated to Salesforce. Please authenticate first.');
		}

		// Prepare request options
		const requestOptions = {headers: headers || null, queryParams: urlParams || null};

		logger.info(`Invoking Apex REST Resource "${apexRestResource}" (${operation}) and body ${processedBody}`);

		// Make the API call
		const response = await callSalesforceApi(operation, 'APEX', apexRestResource, processedBody, requestOptions);

		logger.info(`Invoking Apex REST Resource "${apexRestResource}" (${operation}) and body ${processedBody}`);


		return {
			content: [{
				type: 'text',
				text: `Successfully called "${apexRestResource}" Apex rest resource`
			}],
			structuredContent: response
		};

	} catch (error) {
		logger.error(error, 'Error invoking Apex REST Resource');

		const errorResult = {
			endpoint: state?.org?.instanceUrl ? `${state.org.instanceUrl}/apexrest/${apexRestResource}` : 'Unknown',
			request: {
				method: operation?.toUpperCase() || 'Unknown',
				url: `/apexrest/${apexRestResource}`,
				body: processedBody,
				urlParams: urlParams || {},
				headers: headers || {}
			},
			error: error.message,
			status: 'error',
			success: false
		};

		const errorText = `## Apex REST Resource Invocation Error

**Endpoint:** ${errorResult.endpoint}
**Method:** ${errorResult.request.method}
**Status:** ❌ Error

### Error Details
\`\`\`
${error.message}
\`\`\`

### Request Details
- **URL:** ${errorResult.request.url}
- **Body:** ${errorResult.request.body ? '```json\n' + (typeof errorResult.request.body === 'string' ? errorResult.request.body : JSON.stringify(errorResult.request.body, null, 2)) + '\n```' : 'None'}
- **URL Parameters:** ${Object.keys(errorResult.request.urlParams).length > 0 ? '```json\n' + JSON.stringify(errorResult.request.urlParams, null, 2) + '\n```' : 'None'}
- **Custom Headers:** ${Object.keys(errorResult.request.headers).length > 0 ? '```json\n' + JSON.stringify(errorResult.request.headers, null, 2) + '\n```' : 'None'}`;

		return {
			isError: true,
			content: [{
				type: 'text',
				text: errorText
			}],
			structuredContent: errorResult
		};
	}
}
