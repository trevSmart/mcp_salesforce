import {executeSoqlQuery} from '../salesforceServices.js';
import {textFileContent, log} from '../utils.js';

export const getRecentlyViewedRecordsToolDefinition = {
	name: 'getRecentlyViewedRecords',
	title: 'Get Recently Viewed Records',
	description: textFileContent('getRecentlyViewedRecordsTool'),
	inputSchema: {},
	annotations: {
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Get Recently Viewed Records'
	}
};

export async function getRecentlyViewedRecordsTool() {
	try {
		// Use executeSoqlQuery to get all recently viewed records
		const query = 'SELECT Id, Name, Type, LastViewedDate, LastReferencedDate FROM RecentlyViewed ORDER BY LastViewedDate DESC';
		const response = await executeSoqlQuery(query, false);

		log(response, 'debug', 'Recently viewed records via SOQL');

		// Extract records from the SOQL response
		const records = response?.records || [];

		return {
			content: [{
				type: 'text',
				text: `Retrieved ${records.length} recently viewed records successfully`
			}],
			structuredContent: {
				records: records,
				totalSize: response?.totalSize || 0,
				done: response?.done || true
			}
		};

	} catch (error) {
		log(error, 'error', 'Error getting recently viewed records');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: error?.message
			}]
		};
	}
}