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

	const result = {
		content: [
			{
				type: 'text',
				text: 'Org details:\n\n' + JSON.stringify(salesforceState.orgDescription, null, '\t')
			},
			{
				type: 'text',
				text: 'User details:\n\n' + JSON.stringify(salesforceState.userDescription, null, '\t')
			}
		]
	};
	globalCache.set(org, tool, key, result);
	return result;
}

export default getOrgAndUserDetails;