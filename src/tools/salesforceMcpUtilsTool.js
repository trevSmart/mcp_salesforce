import {globalCache} from '../cache.js';
import {log} from '../utils.js';
import {loadToolDescription} from '../utils.js';

export const salesforceMcpUtilsToolDefinition = {
	name: 'salesforceMcpUtils',
	title: 'Salesforce MCP Utils',
	description: loadToolDescription('salesforceMcpUtilsTool'),
	inputSchema: {
		type: 'object',
		required: ['action'],
		properties: {
			action: {
				type: 'string',
				description: 'The action to perform, possible values: "clearCache", "getCurrentDatetime"'
			}
		}
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
			globalCache.clear(true);

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
		} else {
			throw new Error(`Invalid action: ${action}`);
		}
		return {
			content: [{
				type: 'text',
				text: `✅ Action "${action}" executed successfully`
			}],
			structuredContent: {action, status: 'success'}
		};

	} catch (error) {
		log(`Error executing action "${action}":`, 'error');
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