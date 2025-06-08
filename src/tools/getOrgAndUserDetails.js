import {getOrgDescription, getUserDescription} from '../../index.js';
import {log} from '../utils.js';

const orgAndUserDetailsCache = {};
const CACHE_TTL_MS = 60 * 60 * 1000; //1 hour in milliseconds

async function getOrgAndUserDetails() {
	const cacheKey = 'orgAndUserDetails';
	const cached = orgAndUserDetailsCache[cacheKey];
	const now = Date.now();
	if (cached && now - cached.timestamp < CACHE_TTL_MS) {
		return cached.result;
	}

	const result = {
		content: [
			{
				type: 'text',
				text: JSON.stringify(getOrgDescription(), null, '\t')
			},
			{
				type: 'text',
				text: JSON.stringify(getUserDescription(), null, '\t')
			}
		]
	};
	orgAndUserDetailsCache[cacheKey] = {result, timestamp: now};
	return result;
}

export default getOrgAndUserDetails;