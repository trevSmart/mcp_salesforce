import {getOrgDescription} from '../../index.js';
import {runCliCommand, log} from '../utils.js';

async function getRecentlyViewedRecords() {
	try {
		const command = `sf data query --query "SELECT Id, Type, Name, FORMAT(LastViewedDate) FROM RecentlyViewed WHERE LastViewedDate != NULL ORDER BY LastViewedDate DESC LIMIT 100" -o ${getOrgDescription().alias} --json`;
		log(`Executing query command: ${command}`);
		const response = JSON.parse(await runCliCommand(command));
		return {
			content: [{
				type: 'text',
				text: `✅ Recently viewed records: ${JSON.stringify(response.result.records, null, '\t')}`
			}]
		};

	} catch (error) {
		log('Error obtaining recently viewed records:', error);
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export default getRecentlyViewedRecords;