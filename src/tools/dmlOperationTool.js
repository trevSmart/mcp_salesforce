import state from '../state.js';
import { log, textFileContent } from '../utils.js';
import { createRecord, updateRecord, deleteRecord, updateBulk, createBulk, deleteBulk } from '../salesforceServices.js';
import { mcpServer } from '../mcp-server.js';
import client from '../client.js';
import { z } from 'zod';

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
			.optional()
			.describe('Required unless bulk update is used (For "delete" operation, pass {}). An object with the field values for the record. E.g. {"Name": "New Name", "Description": "New Description"}.'),
		bulk: z
			.boolean()
			.optional()
			.describe('Enable bulk mode for the operation. Supported for operations "create", "update" and "delete".'),
		filePath: z
			.string()
			.optional()
			.describe('Required when bulk=true. Absolute path to the CSV file to process.'),
		wait: z
			.number()
			.optional()
			.default(5)
			.describe('When bulk=true, minutes to wait for the command to finish before returning.'),
		lineEnding: z
			.enum(['CRLF', 'LF'])
			.optional()
			.describe('When bulk=true, line ending used in the CSV file.'),
		columnDelimiter: z
			.enum(['BACKQUOTE', 'CARET', 'COMMA', 'PIPE', 'SEMICOLON', 'TAB'])
			.optional()
			.describe('When bulk=true for create/update, column delimiter used in the CSV file.'),
	},
	annotations: {
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'DML Operation'
	}
};

export async function dmlOperationTool({ operation, sObjectName, recordId, fields, bulk, filePath, wait, lineEnding, columnDelimiter }) {
	try {
		if (!operation || !sObjectName || typeof sObjectName !== 'string') {
			throw new Error('Operation and SObject name are required');
		}

		switch (operation) {
			case 'create': {
				if (bulk) {
					if (!filePath || typeof filePath !== 'string') {
						throw new Error('filePath is required and must be a string when bulk=true for create operation');
					}
					const options = { wait, lineEnding, columnDelimiter };
					const result = await createBulk(sObjectName, filePath, options);
					const structuredContent = { operation, sObject: sObjectName, bulk: true, filePath, result };
					return {
						content: [{ type: 'text', text: `✅ Bulk create launched for ${sObjectName} using file "${filePath}".` }],
						structuredContent
					};
				} else {
					const fieldsObject = typeof fields === 'string' ? JSON.parse(fields) : fields;
					if (!fieldsObject || typeof fieldsObject !== 'object') {
						throw new Error('Field values must be a valid object or JSON string');
					}
					const result = await createRecord(sObjectName, fieldsObject);
					const newRecordId = result.id || result.Id;
					const recordUrl = `${state.org.instanceUrl}/${newRecordId}`;
					const structuredContent = { operation, sObject: sObjectName, result };
					return {
						content: [{ type: 'text', text: `✅ Record created successfully with id "${newRecordId}".\n🔗 [View record in Salesforce](${recordUrl})` }],
						structuredContent
					};
				}
			}
			case 'update': {
				if (bulk) {
					if (!filePath || typeof filePath !== 'string') {
						throw new Error('filePath is required and must be a string when bulk=true for update operation');
					}
					const options = { wait, lineEnding, columnDelimiter };
					const result = await updateBulk(sObjectName, filePath, options);
					const structuredContent = {
						operation,
						sObject: sObjectName,
						bulk: true,
						filePath,
						result
					};
					return {
						content: [{
							type: 'text',
							text: `✅ Bulk update launched for ${sObjectName} using file "${filePath}".`
						}],
						structuredContent
					};
				} else {
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
			}
			case 'delete': {
				if (bulk) {
					if (!filePath || typeof filePath !== 'string') {
						throw new Error('filePath is required and must be a string when bulk=true for delete operation');
					}
					const options = { wait, lineEnding };
					const result = await deleteBulk(sObjectName, filePath, options);
					const structuredContent = { operation, sObject: sObjectName, bulk: true, filePath, result };
					return {
						content: [{ type: 'text', text: `✅ Bulk delete launched for ${sObjectName} using file "${filePath}".` }],
						structuredContent
					};
				}

				if (!recordId) {
					throw new Error('Record ID is required for delete operation');
				}

				if (client.supportsCapability('elicitation')) {
					const elicitResult = await mcpServer.server.elicitInput({
						message: `Please confirm the deletion of the ${sObjectName} record with id "${recordId}" in ${state.org.alias}.`,
						requestedSchema: {
							type: "object",
							title: `Delete ${sObjectName} record (Id: ${recordId}) in ${state.org.alias}?`,
							properties: {
								confirm: {
									type: "string",
									enum: ["Yes", "No"],
									enumNames: ["Delete record now", "Cancel record deletion"],
									description: `Delete ${sObjectName} record (Id: ${recordId}) in ${state.org.alias}?`,
									default: "No"
								}
							},
							required: ["confirm"]
						}
					});

					if (elicitResult.action !== 'accept' || elicitResult.content?.confirm !== 'Yes') {
						return {
							content: [{
								type: 'text',
								text: 'User has cancelled the record deletion'
							}],
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