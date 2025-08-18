import state from '../state.js';
import { log, textFileContent } from '../utils.js';
import { dmlOperation } from '../salesforceServices.js';
import { mcpServer } from '../mcp-server.js';
import client from '../client.js';
import { z } from 'zod';

export const dmlOperationToolDefinition = {
	name: 'dmlOperation',
	title: 'DML Operations (Create, Update or Delete)',
	description: textFileContent('dmlOperationTool'),
	inputSchema: {
		operations: z.object({
			create: z.array(z.object({
				sObjectName: z.string()
					.describe('The SObject type for the record to create'),
				fields: z.record(z.any())
					.describe('Field values for the record to create')
			}))
				.optional().describe('Array of records to create'),
			update: z.array(z.object({
				sObjectName: z.string().describe('The SObject type for the record to update'),
				recordId: z.string().describe('The ID of the record to update'),
				fields: z.record(z.any()).describe('Field values to update')
			}))
				.optional().describe('Array of records to update'),
			delete: z.array(z.object({
				sObjectName: z.string().describe('The SObject type for the record to delete'),
				recordId: z.string().describe('The ID of the record to delete')
			}))
				.optional().describe('Array of records to delete'),
		})
			.describe('DML operations to perform'),
		options: z.object({
			allOrNone: z.boolean()
				.default(false)
				.describe('If true, all operations must succeed or none will be committed'),
			bypassUserConfirmation: z.boolean()
				.default(false)
				.describe('Whether to bypass user confirmation for destructive operations')
		})
			.optional()
			.describe('Additional options for the request')
	},
	annotations: {
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'DML Operations (Create, Update or Delete)'
	}
};

export async function dmlOperationTool({ operations, options = {} }) {
	try {
		// Check for destructive operations and require confirmation if needed
		if (options.bypassUserConfirmation !== true
		&& (operations.delete?.length || operations.update?.length)
		&& client.supportsCapability('elicitInput')) {
			const deleteCount = operations.delete?.length || 0;
			const updateCount = operations.update?.length || 0;

			const elicitResult = await mcpServer.server.elicitInput({
				message: `Please confirm the operation in ${state.org.alias}. The request includes ${deleteCount} delete(s) and ${updateCount} update(s).`,
				requestedSchema: {
					type: "object",
					title: `Confirm DML operations in ${state.org.alias}?`,
					properties: {
						confirm: {
							type: "string",
							enum: ["Yes", "No"],
							enumNames: ["✅ Execute DML operations now", "❌ Cancel DML operations"],
							description: `Execute DML operations in ${state.org.alias}?`,
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
						text: 'User has cancelled the operations'
					}],
					structuredContent: { cancelled: true, reason: 'user_cancelled' }
				};
			}
		}

		const response = await dmlOperation(operations, options);

		// Check if the response indicates errors and mark accordingly
		if (response.hasErrors) {
			// Generate error summary message
			const errorSummaryText = `DML request completed with ${response.failedRecords} error(s). ${response.successfulRecords} operation(s) succeeded, ${response.failedRecords} failed.`;

			return {
				isError: true,
				content: [{
					type: 'text',
					text: `❌ ${errorSummaryText}`
				}],
				structuredContent: response
			};
		}

		// Generate success summary message
		const successSummaryText = `DML request completed successfully. All ${response.successfulRecords} operation(s) succeeded.`;

		return {
			content: [{
				type: 'text',
				text: successSummaryText
			}],
			structuredContent: response
		};

	} catch (error) {
		log(`Error in dmlOperationTool: ${error.message}`, 'error');

		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error in DML operation request: ${error.message}`
			}],
			structuredContent: error
		};
	}
}
