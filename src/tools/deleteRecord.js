import {salesforceState} from '../state.js';
import {runCliCommand, log} from '../utils.js';
import { sObjectNameSchema, recordIdSchema } from './paramSchemas.js';
import { z } from 'zod';

async function deleteRecord(params) {
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

	try {
		log(`Executing delete record command: ${params.sObjectName} ${params.recordId}`);
		const command = `sf data delete record --sobject ${params.sObjectName} --record-id ${params.recordId} -o "${salesforceState.orgDescription.alias}" --json`;
		const response = await runCliCommand(command);

		log(`Tool response: ${response}`, 'debug');
		if (response.status !== 0) {
			const errorContent = {error: true, message: response.message};
			return {
				isError: true,
				content: [{
					type: 'text',
					text: JSON.stringify(errorContent)
				}],
				structuredContent: errorContent
			};
		} else {
			const structuredContent = {
				id: params.recordId,
				sObject: params.sObjectName
			};
			return {
				content: [{
					type: 'text',
					text: JSON.stringify(structuredContent)
				}],
				structuredContent
			};
		}
	} catch (error) {
		log(`Error deleting ${params.sObjectName} record ${params.recordId}:`, JSON.stringify(error, null, 2));
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

export default deleteRecord;