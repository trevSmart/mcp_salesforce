import {getRecordById} from '../salesforceServices/getRecord.js';
import {loadToolDescription} from '../utils.js';

export const getRecordToolDefinition = {
	name: 'getRecord',
	title: 'Get Record',
	description: loadToolDescription('getRecordTool'),
	inputSchema: {
		type: 'object',
		required: ['sObjectName', 'recordId'],
		properties: {
			sObjectName: {
				type: 'string',
				description: 'The name of the SObject type of the record to retrieve.',
			},
			recordId: {
				type: 'string',
				description: 'The Id of the record to retrieve.',
			}
		}
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
			return {
				isError: true,
				content: [{
					type: 'text',
					text: 'Error de validación, es obligatorio indicar un valor de sObjectName y recordId'
				}]
			};
		}

		const result = await getRecordById(sObjectName, recordId);
		const structuredContent = {
			id: recordId,
			sObject: sObjectName,
			fields: result
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