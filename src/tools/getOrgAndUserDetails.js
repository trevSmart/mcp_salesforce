import {salesforceState} from '../state.js';
import {globalCache} from '../cache.js';
import {log, runCliCommand} from '../utils.js';

async function getOrgAndUserDetails() {
	const org = salesforceState.orgDescription.alias;
	const tool = 'orgUserDetails';
	const key = 'main';
	const cached = globalCache.get(org, tool, key);
	if (cached) {
		return cached;
	}

	const structuredContent = {
		org: salesforceState.orgDescription,
		user: salesforceState.userDescription
	};
	const result = {
		content: [
			{
				type: 'text',
				text: JSON.stringify(structuredContent)
			}
		],
		structuredContent
	};
	globalCache.set(org, tool, key, result);
	return result;
}

export default getOrgAndUserDetails;