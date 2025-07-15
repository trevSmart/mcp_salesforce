import {runCliCommand} from './runCliCommand.js';
import {log} from '../utils.js';
import state from '../state.js';
import {executeSoqlQuery} from './executeSoqlQuery.js';

export async function getOrgAndUserDetails() {
	try {
		const orgResult = JSON.parse(await runCliCommand('sf org display user --json'))?.result;
		const soqlUserResult = await executeSoqlQuery(`SELECT Name FROM User WHERE Id = '${orgResult.id}'`);
		const userFullName = soqlUserResult?.records?.[0]?.Name;
		const {id, username, profileName, ...orgResultWithoutUserFields} = orgResult;
		const orgDescription = {
			...orgResultWithoutUserFields, user: {id, username, profileName, name: userFullName}
		};

		if (!orgDescription || !orgDescription.user || !orgDescription.user.id) {
			throw new Error('Error: No se pudo obtener la información del usuario de Salesforce');
		}
		log(`Org and user details successfully retrieved: \n${JSON.stringify(orgDescription, null, '\t')}`);
		state.orgDescription = orgDescription;
		return orgDescription;

	} catch (error) {
		log('Error getting org and user details:', 'error');
		log(error, 'error');
		state.server.close();
		process.exit(1);
	}
}