import {salesforceState} from '../state.js';
import {runCliCommand, log, notifyProgressChange} from '../utils.js';
import {operationSchema, sObjectNameSchema, recordIdSchema, fieldsSchema} from './paramSchemas.js';
import {z} from 'zod';

async function dmlOperation(params, _meta) {
	const schema = z.object({
		operation: operationSchema,
		sObjectName: sObjectNameSchema,
		recordId: recordIdSchema.optional(),
		fields: fieldsSchema.optional(),
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

	let command;

	try {
		if (!params.sObjectName || typeof params.sObjectName !== 'string') {
		//Validate sObjectName
			throw new Error('SObject name must be a non-empty string');
		}

		//Prepare command based on operation
		switch (params.operation) {
			case 'create': {
				notifyProgressChange(_meta.progressToken, 1, 1, 'Executing DML operation (create)');

				const fieldsObject = typeof params.fields === 'string' ? JSON.parse(params.fields) : params.fields;
				if (!fieldsObject || typeof fieldsObject !== 'object') {
					throw new Error('Field values must be a valid object or JSON string');
				}

				const valuesString = Object.entries(fieldsObject).map(([key, value]) => {
					const escapedValue = String(value).replace(/'/g, '\\\'');
					return `${key}='${escapedValue}'`;
				}).join(' ');

				command = `sf data create record --sobject ${params.sObjectName} --values "${valuesString}" -o "${salesforceState.orgDescription.alias}" --json`;
				break;
			}

			case 'update': {
				notifyProgressChange(_meta.progressToken, 2, 2, 'Executing DML operation (update)');

				if (!params.recordId) {throw new Error('Record ID is required for update operation')}
				const fieldsObject = typeof params.fields === 'string' ? JSON.parse(params.fields) : params.fields;
				if (!fieldsObject || typeof fieldsObject !== 'object') {
					throw new Error('Field values must be a valid object or JSON string');
				}
				const valuesString = Object.entries(fieldsObject)
					.map(([key, value]) => `${key}='${String(value).replace(/'/g, '\\\'')}'`)
					.join(' ');
				command = `sf data update record --sobject ${params.sObjectName} --record-id ${params.recordId} --values "${valuesString}" -o "${salesforceState.orgDescription.alias}" --json`;
				break;
			}

			case 'delete': {
				notifyProgressChange(_meta.progressToken, 3, 3, 'Executing DML operation (delete)');

				if (!params.recordId) {throw new Error('Record ID is required for delete operation')}
				command = `sf data delete record --sobject ${params.sObjectName} --record-id ${params.recordId} -o "${salesforceState.orgDescription.alias}" --json`;
				break;
			}

			default:
				throw new Error(`Invalid operation: "${params.operation}". Must be "create", "update", or "delete".`);
		}

		//Execute command
		log(`Executing DML operation: ${command}`);
		const rawResponse = await runCliCommand(command);
		log(`DML operation result: ${rawResponse}`, 'debug');

		const response = JSON.parse(rawResponse);

		if (response.status !== 0) {
			log(`Parsed error response: ${JSON.stringify(response, null, 2)}`);
			const errorMessage = response.result?.errors?.[0]?.message || response.message || 'An unknown error occurred.';
			throw new Error(`Failed to ${params.operation} record: ${errorMessage}`);
		}

		//Handle success response
		const result = response.result;
		switch (params.operation) {
			case 'create': {
				const newRecordId = result.id || result.Id;
				const recordUrl = `https://${salesforceState.orgDescription.instanceUrl}/${newRecordId}`;
				successMessage = `✅ Record created successfully with id "${newRecordId}".\n🔗 [View record in Salesforce](${recordUrl})`;
				break;
			}
			case 'update':
				successMessage = `✅ Record with id "${params.recordId}" updated successfully.`;
				break;
			case 'delete':
				successMessage = `✅ Record with id "${params.recordId}" deleted successfully.`;
				break;
		}

		const structuredContent = {
			operation: params.operation,
			sObject: params.sObjectName,
			result: result
		};
		return {
			content: [{
				type: 'text',
				text: JSON.stringify(structuredContent)
			}],
			structuredContent
		};

	} catch (error) {
		log(`Error during DML operation "${params.operation}" on ${params.sObjectName}: ${error.message}`);
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

export default dmlOperation;