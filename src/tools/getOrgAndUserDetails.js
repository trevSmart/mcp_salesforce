import {getOrgDescription, getUserDescription} from '../../index.js';
import {globalCache, CACHE_TTL} from '../utils/cache.js';

async function getOrgAndUserDetails() {
	const cacheKey = `orgUserDetails:${getOrgDescription().alias}`;
	const cached = globalCache.get(cacheKey);
	if (cached) {
		return cached;
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
	globalCache.set(cacheKey, result, CACHE_TTL.ORG_USER_DETAILS);
	return result;
}

export default getOrgAndUserDetails;