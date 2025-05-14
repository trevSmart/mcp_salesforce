/*globals process */
import {runCliCommand} from './utils.js';

async function getRecentlyViewedRecords() {
	try {
		const command = `sf data query --query "SELECT Id, Type, Name, FORMAT(LastViewedDate) FROM RecentlyViewed WHERE LastViewedDate != NULL ORDER BY LastViewedDate DESC LIMIT 100" -o ${process.env.username} --json`;
		console.error(`Executing query command: ${command}`);
		const response = await runCliCommand(command);
		return {
			content: [{
				type: 'text',
				text: `✅ Recently viewed records: ${JSON.stringify(response.result.records, null, '\t')}`
			}]
		};

	} catch (error) {
		console.error('Error obtaining recently viewed records:', error);
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export {getRecentlyViewedRecords};