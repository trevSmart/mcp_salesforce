import {getOrgAndUserDetails} from '../salesforceServices/getOrgAndUserDetails.js';
import {state} from '../state.js';
import {loadToolDescription, log, setResource} from '../utils.js';

export const getOrgAndUserDetailsToolDefinition = {
	name: 'getOrgAndUserDetails',
	title: 'Get the Salesforce organization and current user details.',
	description: loadToolDescription('getOrgAndUserDetailsTool'),
	inputSchema: {
		type: 'object',
		properties: {}
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: false,
		title: 'Get the Salesforce organization and current user details.'
	}
};

export async function getOrgAndUserDetailsTool() {
	try {
		const result = await getOrgAndUserDetails();
		const content = [{
			type: 'text',
			text: JSON.stringify(result, null, 2)
		}];

		if (state.client.clientInfo.isVscode) {
			content.push(setResource('mcp://org/org-and-user-details2.json', 'application/json', JSON.stringify(result, null, 2)));
		}

		return {content, structuredContent: result};

	} catch (error) {
		log(`Error getting org and user details: ${error.message}`, 'error');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error getting org and user details: ${error.message}`
			}]
		};
	}
}