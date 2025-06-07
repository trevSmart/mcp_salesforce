import {getOrgDescription} from '../index.js';

const orgDetailsCache = {};
const CACHE_TTL_MS = 60 * 60 * 1000; //1 hour in milliseconds

async function orgDetails(args, _meta) {
	const cacheKey = 'orgDetails';
	const cached = orgDetailsCache[cacheKey];
	const now = Date.now();
	if (cached && now - cached.timestamp < CACHE_TTL_MS) {
		console.error('Returning cached orgDetails');
		return cached.result;
	}

	const result = {
		content: [
			{
				type: 'text',
				text: JSON.stringify(getOrgDescription(), null, '\t')
			}
		]
	};
	orgDetailsCache[cacheKey] = {result, timestamp: now};
	return result;
}

export {orgDetails};