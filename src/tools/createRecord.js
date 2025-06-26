import {salesforceState} from '../state.js';
import {runCliCommand, log} from '../utils.js';
import { sObjectNameSchema, fieldsSchema } from './paramSchemas.js';
import { z } from 'zod';

async function createRecord(params) {
	// VALIDACIÓ
	const schema = z.object({
		sObjectName: sObjectNameSchema,
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
		//Ensure fields is a proper object
		let fieldsObject;
		if (typeof params.fields === 'string') {
			fieldsObject = JSON.parse(params.fields);
		} else if (typeof params.fields === 'object' && params.fields !== null) {
			fieldsObject = params.fields;
		} else {
			throw new Error('Field values must be a valid object or JSON string');
		}

		//Validate object name
		if (!params.sObjectName || typeof params.sObjectName !== 'string') {
			throw new Error('SObject name must be a non-empty string');
		}

		//Convert fields object to CLI format with proper escaping
		const valuesString = Object.entries(fieldsObject)
			.map(([key, value]) => {
				//Escape single quotes in values
				const escapedValue = String(value).replace(/'/g, '\\\'');
				return `${key}='${escapedValue}'`;
			}).join(' ');

		//Execute sf CLI command
		const command = `sf data create record --sobject ${params.sObjectName} --values "${valuesString}" -o "${salesforceState.orgDescription.alias}" --json`;
		log(`Executing create record command: ${command}`);
		const rawResponse = await runCliCommand(command);
		const response = JSON.parse(rawResponse);

		log(`Tool response: ${JSON.stringify(response, null, 2)}`, 'debug');

		if (response.status !== 0) {
			const errorMessage = response.result?.errors?.[0]?.message || response.message || 'An unknown error occurred.';
			const errorContent = {error: true, message: `Failed to create record: ${errorMessage}`};
			return {
				isError: true,
				content: [{
					type: 'text',
					text: JSON.stringify(errorContent)
				}],
				structuredContent: errorContent
			};
		} else {
			const recordId = response.result.Id;
			const recordUrl = `https://${salesforceState.orgDescription.instanceUrl}/${recordId}`;
			const structuredContent = {
				id: recordId,
				url: recordUrl,
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
		}
	} catch (error) {
		log(`Error creating ${params.sObjectName} record:`, JSON.stringify(error, null, 2));
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

export default createRecord;