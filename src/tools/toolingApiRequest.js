import {callSalesforceAPI} from '../utils.js';
import {globalCache} from '../cache.js';
import {getOrgDescription} from '../../index.js';

async function toolingApiRequest({method, endpoint}) {
	try {
		const toolingEndpoint = endpoint.startsWith('/tooling')
			? endpoint
			: `/tooling${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

		//Només cacheem GET requests (no modifiquen dades)
		if (method.toUpperCase() === 'GET') {
			const org = getOrgDescription().alias;
			const tool = 'tooling';
			const key = `${method}:${toolingEndpoint}`;
			const cached = globalCache.get(org, tool, key);

			if (cached) {
				return cached;
			}

			const result = await callSalesforceAPI(
				method,
				toolingEndpoint
			);

			const response = {
				content: [
					{
						type: 'text',
						text: JSON.stringify(result, null, 2)
					}
				]
			};

			//Només guardem al cache si no hi ha error
			if (!result || result.isError || result.error) {
				return response;
			}
			globalCache.set(org, tool, key, response);
			return response;
		} else {
			//Per a POST/PUT/DELETE no fem cache
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