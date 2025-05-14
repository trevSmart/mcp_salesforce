/*globals process */
import {callSalesforceAPI} from './utils.js';

async function toolingApiRequest({method, endpoint}) {
	try {
		const toolingEndpoint = endpoint.startsWith('/tooling')
			? endpoint
			: `/tooling${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

		const result = await callSalesforceAPI(
			method,
			toolingEndpoint
		);

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(result, null, 2)
				}
			]
		};
	} catch (error) {
		return {
			content: [
				{
					type: 'text',
					text: `Error in calling Salesforce Tooling API (${method} ${endpoint}): ${error.message}`
				}
			]
		};
	}
}

export {toolingApiRequest};