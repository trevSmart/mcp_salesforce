import {z} from 'zod';
import {sObjectNameSchema, recordIdSchema} from './paramSchemas.js';
import {getRecordById} from '../salesforceServices/getRecord.js';

export default async function getRecordTool(params) {
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