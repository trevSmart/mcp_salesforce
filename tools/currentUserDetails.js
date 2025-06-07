import {getUserDescription} from '../index.js';

const userDetailsCache = {};
const CACHE_TTL_MS = 60 * 60 * 1000; //1 hour in milliseconds

async function currentUserDetails(args, _meta) {
	const cacheKey = 'currentUser';
	const cached = userDetailsCache[cacheKey];
	const now = Date.now();
	if (cached && now - cached.timestamp < CACHE_TTL_MS) {
		console.error('Returning cached currentUserDetails');
		return cached.result;
	}

	const result = {
		content: [
			{
				type: 'text',
				text: JSON.stringify(getUserDescription(), null, '\t')
			}
		]
	};
	userDetailsCache[cacheKey] = {result, timestamp: now};
	return result;
}

export {currentUserDetails};