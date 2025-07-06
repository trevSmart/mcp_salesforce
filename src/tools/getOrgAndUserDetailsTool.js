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
		content: [{
			type: 'text',
			text: JSON.stringify(result, null, '\t')
		}],
		structuredContent: result
	};
}