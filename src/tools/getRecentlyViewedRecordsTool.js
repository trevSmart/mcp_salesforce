import {executeSoqlQuery} from '../salesforceServices/soqlQuery.js';

async function getRecentlyViewedRecordsTool() {
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

export default getRecentlyViewedRecordsTool;