import state from '../state.js';
import {log, textFileContent} from '../utils.js';
import {createRecord, updateRecord, deleteRecord} from '../salesforceServices.js';
import {sendElicitRequest} from '../mcp-server.js';
import client from '../client.js';
import {z} from 'zod';

export const dmlOperationToolDefinition = {
	name: 'dmlOperation',
	title: 'DML Operation (create, update or delete a record)',
	description: textFileContent('dmlOperationTool'),
	inputSchema: {
		operation: z
			.enum(['create', 'update', 'delete'])
			.describe('The DML operation to perform. Possible values: "create", "update", "delete".'),
		sObjectName: z
			.string()
			.describe('The SObject type of the record.'),
		recordId: z
			.string()
			.optional()
			.describe('Only applicable for operations "update" and "delete". The ID of the record.'),
		fields: z
			.record(z.string())
			.describe('Required (For "delete" operation, pass {}). An object with the field values for the record. E.g. {"Name": "New Name", "Description": "New Description"}.')
	},
	annotations: {
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'DML Operation'
	}
};

export async function dmlOperationTool({operation, sObjectName, recordId, fields}) {
	try {
		if (!operation || !sObjectName || typeof sObjectName !== 'string') {
			throw new Error('Operation and SObject name are required');
		}

		switch (operation) {
			case 'create': {
				const fieldsObject = typeof fields === 'string' ? JSON.parse(fields) : fields;
				if (!fieldsObject || typeof fieldsObject !== 'object') {
					throw new Error('Field values must be a valid object or JSON string');
				}
				const result = await createRecord(sObjectName, fieldsObject);
				const newRecordId = result.id || result.Id;
				const recordUrl = `${state.org.instanceUrl}/${newRecordId}`;
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
				if (client.supportsCapability('elicitation')) {
					const elicitResult = await sendElicitRequest({confirmation: {
						type: 'string',
						title: 'Confirmation',
						description: `Are you sure you want to delete the "${sObjectName}" record with id "${recordId}"?`,
						enum: ['Delete record', 'Cancel'],
						enumNames: ['Delete record', 'Cancel']
					}});
					if (elicitResult.action !== 'accept' || elicitResult.content?.confirmation !== 'Delete record') {
						return {
							content: [{type: 'text', text: 'Delete operation cancelled by user'}],
							structuredContent: elicitResult
						};
					}
				}
				const result = await deleteRecord(sObjectName, recordId);
				return {
					content: [{
						type: 'text',
						text: `${sObjectName} record with id "${recordId}" deleted successfully.`
					}],
					structuredContent: result
				};
			}
			default:
				throw new Error(`Invalid operation: "${operation}". Must be "create", "update", or "delete".`);
		}

	} catch (error) {
		log(error, 'error');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: JSON.stringify(error.message)
			}]
		};
	}
}