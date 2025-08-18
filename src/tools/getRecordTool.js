import {getRecord} from '../salesforceServices.js';
import {log, textFileContent} from '../utils.js';
import {z} from 'zod';
import state from '../state.js';

export const getRecordToolDefinition = {
	name: 'getRecord',
	title: 'Get Record',
	description: textFileContent('getRecordTool'),
	inputSchema: {
		sObjectName: z
			.string()
			.describe('The name of the SObject type of the record to retrieve.'),
		recordId: z
			.string()
			.describe('The Id of the record to retrieve.')
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Get Record'
	}
};

export async function getRecordTool({sObjectName, recordId}) {
	try {
		if (!sObjectName || !recordId) {
			throw new Error('SObject name and record ID are required');
		}

		const result = await getRecord(sObjectName, recordId);

		return {
			content: [{
				type: 'text',
				text: `Successfully retrieved details for the ${sObjectName} record with Id ${recordId}`
			}],
			structuredContent: result
		};

	} catch (error) {
		log(error, 'error');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: error.message
			}],
			structuredContent: error
		};
	}
}