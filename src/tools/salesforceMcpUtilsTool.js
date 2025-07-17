import {globalCache} from '../cache.js';
import state from '../state.js';
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
				description: 'The action to perform, possible values: "clearCache", "getCurrentDatetime" and "getState"'
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

			return {
				content: [{
					type: 'text',
					text: '✅ Cache cleared successfully'
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
			return {
				content: [{
					type: 'text',
					text: JSON.stringify(state, null, 2)
				}],
				structuredContent: state
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