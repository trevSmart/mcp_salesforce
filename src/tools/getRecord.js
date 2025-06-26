import {salesforceState} from '../state.js';
import {runCliCommand, log} from '../utils.js';
import { sObjectNameSchema, recordIdSchema } from './paramSchemas.js';
import { z } from 'zod';

async function getRecord(params) {
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
		const command = `sf data get record --sobject ${params.sObjectName} --record-id ${params.recordId} -o "${salesforceState.orgDescription.alias}" --json`;
		log(`Executing get record command: ${command}`);
		const response = await JSON.parse(await runCliCommand(command));
		//const {attributes, ...fields} = response.result;
		const structuredContent = {
			id: params.recordId,
			sObject: params.sObjectName,
			fields: response
		};
		return {
			content: [{
				type: 'text',
				text: JSON.stringify(structuredContent)
			}],
			structuredContent
		};
	} catch (error) {
		log(`Error getting record ${params.recordId} from object ${params.sObjectName}:`, JSON.stringify(error, null, 2));
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

export default getRecord;