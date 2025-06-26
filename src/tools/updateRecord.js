import {salesforceState} from '../state.js';
import {runCliCommand} from '../utils.js';
import pkg from 'lodash';
import { sObjectNameSchema, recordIdSchema, fieldsSchema } from './paramSchemas.js';
import { z } from 'zod';
const {escape} = pkg;

async function updateRecord(params) {
	const schema = z.object({
		sObjectName: sObjectNameSchema,
		recordId: recordIdSchema,
		fields: fieldsSchema,
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
		//Use fields directly if already an object, otherwise try to parse them
		const fieldsObject = typeof params.fields === 'string' ? JSON.parse(params.fields) : params.fields;

		//Convert fields to format "Field1='Value1' Field2='Value2'"
		const valuesString = Object.entries(fieldsObject)
			.map(([key, value]) => `${key}='${escape(value)}'`)
			.join(' ');

		//Execute the CLI command
		const command = `sf data update record --sobject ${params.sObjectName} --where "Id='${params.recordId}'" --values "${valuesString}" -o "${salesforceState.orgDescription.alias}" --json`;
		const response = await runCliCommand(command);

		log(`Tool response: ${response}`, 'debug');

		const structuredContent = {
			id: params.recordId,
			sObject: params.sObjectName,
			fields: fieldsObject
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

export default updateRecord;