import {log} from '../utils.js';
import {callSalesforceApi} from '../salesforceServices/callSalesforceApi.js';
import {globalCache} from '../cache.js';
import {salesforceState} from '../state.js';

async function toolingApiRequest({method, endpoint}) {
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

export default toolingApiRequest;