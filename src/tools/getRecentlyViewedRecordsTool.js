import {executeSoqlQuery} from '../salesforceServices/executeSoqlQuery.js';
import {loadToolDescription} from '../utils.js';

export const getRecentlyViewedRecordsToolDefinition = {
	name: 'getRecentlyViewedRecords',
	title: 'Get Recently Viewed Records',
	description: loadToolDescription('getRecentlyViewedRecordsTool'),
	inputSchema: {
		type: 'object',
		properties: {}
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Get Recently Viewed Records'
	}
};

export async function getRecentlyViewedRecordsTool() {
	try {
		const query = 'SELECT Id, Name, Type, LastViewedDate FROM RecentlyViewed ORDER BY LastViewedDate DESC LIMIT 100';
		const response = await executeSoqlQuery(query);

		const structuredContent = {
			records: response.records
		};
		return {
			content: [{
				type: 'text',
				text: JSON.stringify(structuredContent)
			}],
			structuredContent
		};

	} catch (error) {
		log(error, 'error');
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