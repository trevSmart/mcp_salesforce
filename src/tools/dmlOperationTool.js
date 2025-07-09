import state from '../state.js';
import {log, notifyProgressChange, loadToolDescription} from '../utils.js';
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

export async function dmlOperationTool({operation, sObjectName, recordId, fields}) {
	if (!operation || !sObjectName) {
		return {
			isError: true,
			content: [{
				type: 'text',
				text: 'Error de validación, es obligatorio indicar un valor de operation y sObjectName'
			}]
		};
	}

	try {
		if (!sObjectName || typeof sObjectName !== 'string') {
			throw new Error('SObject name must be a non-empty string');
		}

		switch (operation) {
			case 'create': {
				const fieldsObject = typeof fields === 'string' ? JSON.parse(fields) : fields;
				if (!fieldsObject || typeof fieldsObject !== 'object') {
					throw new Error('Field values must be a valid object or JSON string');
				}
				const result = await createRecord(sObjectName, fieldsObject);
				const newRecordId = result.id || result.Id;
				const recordUrl = `https://${state.orgDescription.instanceUrl}/${newRecordId}`;
				const structuredContent = {
					operation,
					sObject: sObjectName,
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
				if (!recordId) {
					throw new Error('Record ID is required for update operation');
				}
				const fieldsObject = typeof fields === 'string' ? JSON.parse(fields) : fields;
				if (!fieldsObject || typeof fieldsObject !== 'object') {
					throw new Error('Field values must be a valid object or JSON string');
				}
				const result = await updateRecord(sObjectName, recordId, fieldsObject);
				const structuredContent = {
					operation,
					sObject: sObjectName,
					result
				};
				return {
					content: [{
						type: 'text',
						text: `✅ Record with id "${recordId}" updated successfully.`
					}],
					structuredContent
				};
			}
			case 'delete': {
				if (!recordId) {
					throw new Error('Record ID is required for delete operation');
				}
				const result = await deleteRecord(sObjectName, recordId);
				const structuredContent = {
					operation,
					sObject: sObjectName,
					result
				};
				return {
					content: [{
						type: 'text',
						text: `✅ Record with id "${recordId}" deleted successfully.`
					}],
					structuredContent
				};
			}
			default:
				throw new Error(`Invalid operation: "${operation}". Must be "create", "update", or "delete".`);
		}
	} catch (error) {
		log(`Error during DML operation "${operation}" on ${sObjectName}: ${error.message}`);
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