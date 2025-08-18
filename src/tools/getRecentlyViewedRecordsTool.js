import {callSalesforceApi} from '../salesforceServices.js';
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
		const response = await callSalesforceApi('GET', 'REST', '/recent', null, {queryParams: {limit: 80}});
		return {
			content: [{
				type: 'text',
				text: `Last ${response?.length || 0} recently viewed records retrieved successfully`
			}],
			structuredContent: response
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