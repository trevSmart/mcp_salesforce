import {z} from 'zod';
import {sObjectNameSchema, recordIdSchema} from './paramSchemas.js';
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

export async function getRecordTool(params) {
	try {
		const schema = z.object({
			sObjectName: sObjectNameSchema,
			recordId: recordIdSchema,
		});
		const parseResult = schema.safeParse(params);
		if (!parseResult.success) {
			return {
				isError: true,
				content: [{
					type: 'text',
					text: `❌ Error de validació: ${parseResult.error.message}`
				}]
			};
		}

		const result = await getRecordById(params.sObjectName, params.recordId);
		const structuredContent = {
			id: params.recordId,
			sObject: params.sObjectName,
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