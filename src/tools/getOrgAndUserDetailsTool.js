import {getOrgAndUserDetails} from '../salesforceServices/getOrgAndUserDetails.js';
import {loadToolDescription} from '../utils.js';

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
	const result = await getOrgAndUserDetails();
	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify(result, null, '\t')
			},
			{
				type: 'resource',
				resource: {
					uri: 'mcp://org/org-and-user-details2.json',
					name: 'Org and user details2',
					description: 'Salesforce org and user details (org id, org alias, user id, username, and user full name)',
					mimeType: 'application/json'
				}
			}
		],
		structuredContent: result
	};
}