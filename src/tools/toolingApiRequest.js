import {callSalesforceAPI} from '../utils.js';
import {globalCache, CACHE_TTL} from '../utils/cache.js';
import {getOrgDescription} from '../../index.js';

async function toolingApiRequest({method, endpoint}) {
	try {
		const toolingEndpoint = endpoint.startsWith('/tooling')
			? endpoint
			: `/tooling${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

		//Només cacheem GET requests (no modifiquen dades)
		if (method.toUpperCase() === 'GET') {
			const cacheKey = `tooling:${method}:${toolingEndpoint}:${getOrgDescription().alias}`;
			const cached = globalCache.get(cacheKey);

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

			//Guardem al cache
			globalCache.set(cacheKey, response, CACHE_TTL.TOOLING_API_GET);
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