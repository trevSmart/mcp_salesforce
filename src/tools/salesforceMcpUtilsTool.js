import client from '../client.js';
import state from '../state.js';
import {log} from '../utils.js';
import {textFileContent} from '../utils.js';
import {z} from 'zod';
import {clearResources, resources} from '../mcp-server.js';

export const salesforceMcpUtilsToolDefinition = {
	name: 'salesforceMcpUtils',
	title: 'Salesforce MCP Utils',
	description: textFileContent('salesforceMcpUtilsTool'),
	inputSchema: {
		action: z
			.enum(['clearCache', 'getCurrentDatetime', 'getState'])
			.describe('The action to perform: "clearCache", "getCurrentDatetime" or "getState"')
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: false,
		title: 'Salesforce MCP Utils'
	}
};

export async function salesforceMcpUtilsTool({action}) {
	try {
		if (action === 'clearCache') {
			clearResources();
			return {
				content: [{
					type: 'text',
					text: '✅ Cached resources cleared successfully'
				}],
				structuredContent: {action, status: 'success'}
			};

		} else if (action === 'getCurrentDatetime') {
			const now = new Date();

			const result = {
				now,
				nowLocaleString: now.toLocaleString(),
				nowIsoString: now.toISOString(),
				timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone
			};

			return {
				content: [{
					type: 'text',
					text: JSON.stringify(result, null, 2)
				}],
				structuredContent: result
			};

		} else if (action === 'getState') {
			const output = {state, client, resources};
			return {
				content: [{
					type: 'text',
					text: JSON.stringify(output, null, 3)
				}],
				structuredContent: output
			};

		} else {
			throw new Error(`Invalid action: ${action}`);
		}

	} catch (error) {
		log(error, 'error');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}