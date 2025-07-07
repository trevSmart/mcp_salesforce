import state from '../state.js';
import {log, notifyProgressChange, loadToolDescription} from '../utils.js';
import {operationSchema, sObjectNameSchema, recordIdSchema, fieldsSchema} from './paramSchemas.js';
import {z} from 'zod';
import {createRecord} from '../salesforceServices/createRecord.js';
import {updateRecord} from '../salesforceServices/updateRecord.js';
import {deleteRecord} from '../salesforceServices/deleteRecord.js';

export const dmlOperationToolDefinition = {
	name: 'dmlOperation',
	title: 'DML Operation (create, update or delete a record)',
	description: loadToolDescription('dmlOperationTool'),
	inputSchema: {
		type: 'object',
		required: ['operation', 'sObjectName', 'fields'],
		properties: {
			operation: {
				type: 'string',
				description: 'The DML operation to perform. Possible values: "create", "update", "delete".'
			},
			sObjectName: {
				type: 'string',
				description: 'The SObject type of the record.'
			},
			recordId: {
				type: 'string',
				description: 'Only applicable for operations "update" and "delete". The ID of the record.'
			},
			fields: {
				type: 'object',
				description: 'Required (For "delete" operation, pass {}). An object with the field values for the record. E.g. {"Name": "New Name", "Description": "New Description"}.'
			}
		}
	},
	annotations: {
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'DML Operation'
	}
};

export async function dmlOperationTool(params, _meta) {
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
				text: `❌ Validation error: ${parseResult.error.message}`
			}]
		};
	}

	try {
		if (!params.sObjectName || typeof params.sObjectName !== 'string') {
			throw new Error('SObject name must be a non-empty string');
		}

		switch (params.operation) {
			case 'create': {
				notifyProgressChange(_meta.progressToken, 1, 1, 'Executing DML operation (create)');
				const fieldsObject = typeof params.fields === 'string' ? JSON.parse(params.fields) : params.fields;
				if (!fieldsObject || typeof fieldsObject !== 'object') {
					throw new Error('Field values must be a valid object or JSON string');
				}
				const result = await createRecord(params.sObjectName, fieldsObject);
				const newRecordId = result.id || result.Id;
				const recordUrl = `https://${state.orgDescription.instanceUrl}/${newRecordId}`;
				const structuredContent = {
					operation: params.operation,
					sObject: params.sObjectName,
					result
				};
				return {
					content: [{
						type: 'text',
						text: `✅ Record created successfully with id "${newRecordId}".\n🔗 [View record in Salesforce](${recordUrl})`
					}],
					structuredContent
				};
			}
			case 'update': {
				notifyProgressChange(_meta.progressToken, 2, 2, 'Executing DML operation (update)');
				if (!params.recordId) {throw new Error('Record ID is required for update operation')}
				const fieldsObject = typeof params.fields === 'string' ? JSON.parse(params.fields) : params.fields;
				if (!fieldsObject || typeof fieldsObject !== 'object') {
					throw new Error('Field values must be a valid object or JSON string');
				}
				const result = await updateRecord(params.sObjectName, params.recordId, fieldsObject);
				const structuredContent = {
					operation: params.operation,
					sObject: params.sObjectName,
					result
				};
				return {
					content: [{
						type: 'text',
						text: `✅ Record with id "${params.recordId}" updated successfully.`
					}],
					structuredContent
				};
			}
			case 'delete': {
				notifyProgressChange(_meta.progressToken, 3, 3, 'Executing DML operation (delete)');
				if (!params.recordId) {throw new Error('Record ID is required for delete operation')}
				const result = await deleteRecord(params.sObjectName, params.recordId);
				const structuredContent = {
					operation: params.operation,
					sObject: params.sObjectName,
					result
				};
				return {
					content: [{
						type: 'text',
						text: `✅ Record with id "${params.recordId}" deleted successfully.`
					}],
					structuredContent
				};
			}
			default:
				throw new Error(`Invalid operation: "${params.operation}". Must be "create", "update", or "delete".`);
		}
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