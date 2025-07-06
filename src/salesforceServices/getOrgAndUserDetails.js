import {runCliCommand} from './runCliCommand.js';
import {log} from '../utils.js';
import {globalCache} from '../cache.js';
import {salesforceState} from '../state.js';
import {executeSoqlQuery} from './soqlQuery.js';

export async function getOrgAndUserDetails() {
	try {
		const cached = globalCache.get(salesforceState?.orgDescription?.alias, 'getOrgAndUserDetails', 'main');
		if (cached) {
			return cached;
		}

		const orgResult = JSON.parse(await runCliCommand('sf org display user --json'))?.result;
		const soqlUserResult = await executeSoqlQuery(`SELECT Name FROM User WHERE Id = '${orgResult.id}'`);
		const userFullName = soqlUserResult?.records?.[0]?.Name;
		const {id, username, profileName, ...orgResultWithoutUserFields} = orgResult;
		const orgDescription = {
			...orgResultWithoutUserFields, user: {id, username, profileName, name: userFullName}
		};
		log(`Org and user details successfully retrieved: \n${JSON.stringify(orgDescription, null, '\t')}`);

		globalCache.set(orgDescription?.alias, 'getOrgAndUserDetails', 'main', orgDescription);
		return orgDescription;

	} catch (error) {
		log('Error getting org and user details:', 'error');
		log(error, 'error');
		throw error;
	}
}