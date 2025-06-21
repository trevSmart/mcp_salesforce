import {salesforceState} from '../state.js';
import {runCliCommand, log} from '../utils.js';

async function getRecentlyViewedRecords() {
	try {
		const command = `sf data query --query "SELECT Id, Name, SobjectType, LastViewedDate FROM RecentlyViewed ORDER BY LastViewedDate DESC LIMIT 100" -o "${salesforceState.orgDescription.alias}" --json`;
		log(`Executing recently viewed command: ${command}`);
		const response = JSON.parse(await runCliCommand(command));

		if (response.status !== 0) {
			return {
				isError: true,
				content: [{
					type: 'text',
					text: `❌ Error: ${response.errorMessage}`
				}]
			};
		}

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