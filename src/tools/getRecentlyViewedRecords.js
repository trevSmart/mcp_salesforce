import {salesforceState} from '../state.js';
import {runCliCommand, log} from '../utils.js';

async function getRecentlyViewedRecords() {
	try {
		const command = `sf data query --query "SELECT Id, Name, SobjectType, LastViewedDate FROM RecentlyViewed ORDER BY LastViewedDate DESC LIMIT 100" -o "${salesforceState.orgDescription.alias}" --json`;
		log(`Executing recently viewed command: ${command}`);
		const response = JSON.parse(await runCliCommand(command));

		if (response.status !== 0) {
			const errorContent = {error: true, message: response.errorMessage};
			return {
				isError: true,
				content: [{
					type: 'text',
					text: JSON.stringify(errorContent)
				}],
				structuredContent: errorContent
			};
		}

		const structuredContent = {
			records: response.result.records
		};
		return {
			content: [{
				type: 'text',
				text: JSON.stringify(structuredContent)
			}],
			structuredContent
		};

	} catch (error) {
		log('Error obtaining recently viewed records:', error);
		const errorContent = {error: true, message: error.message};
		return {
			isError: true,
			content: [{
				type: 'text',
				text: JSON.stringify(errorContent)
			}],
			structuredContent: errorContent
		};
	}
}

export default getRecentlyViewedRecords;