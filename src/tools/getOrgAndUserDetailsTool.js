import {getOrgAndUserDetails} from '../salesforceServices.js';
import {newResource} from '../mcp-server.js';
import client from '../client.js';
import {log, textFileContent} from '../utils.js';

export const getOrgAndUserDetailsToolDefinition = {
	name: 'getOrgAndUserDetails',
	title: 'Get the Salesforce organization and current user details.',
	description: textFileContent('getOrgAndUserDetailsTool'),
	inputSchema: {},
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

		if (client.isVsCode) {
			const resourceOrgAndUserDetails = newResource(
				'mcp://org/orgAndUserDetail.json',
				'Salesforce org and user details',
				'Details of the current target Salesforce org and logged-in user. This resource can now be reused instead of making new calls to the getOrgAndUserDetails tool.',
				'application/json',
				JSON.stringify(result, null, 3),
				{audience: ['user', 'assistant']}
			);
			content.push({type: 'resource', resource: resourceOrgAndUserDetails});
		}
		return {content, structuredContent: result};

	} catch (error) {
		log(error, 'error');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error getting org and user details: ${error.message}`
			}]
		};
	}
}