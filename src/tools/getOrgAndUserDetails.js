import {getOrgDescription, getUserDescription} from '../../index.js';
import {globalCache} from '../cache.js';

async function getOrgAndUserDetails() {
	const org = getOrgDescription().alias;
	const tool = 'orgUserDetails';
	const key = 'main';
	const cached = globalCache.get(org, tool, key);
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
	globalCache.set(org, tool, key, result);
	return result;
}

export default getOrgAndUserDetails;