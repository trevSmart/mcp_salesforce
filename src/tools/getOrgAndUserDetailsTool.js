import {getOrgAndUserDetails} from '../salesforceServices/getOrgAndUserDetails.js';
import {state} from '../state.js';
import {loadToolDescription, log} from '../utils.js';

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
		const content = [
			{
				type: 'text',
				text: JSON.stringify(result, null, '4')
			}
		];

		if (state.client.clientInfo.isVscode) {
			content.push({
				type: 'resource',
				resource: {
					uri: 'mcp://org/org-and-user-details2.json',
					name: 'Org and user details2',
					description: 'Salesforce org and user details (org id, org alias, user id, username, and user full name)',
					mimeType: 'application/json'
				}
			});
		}

		return {
			content,
			structuredContent: result
		};

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