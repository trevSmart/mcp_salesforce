import {getOrgAndUserDetails} from '../salesforceServices.js';
import state from '../state.js';
import {log, textFileContent} from '../utils.js';
import {z} from 'zod';

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

		if (state.client?.isVscode) {
			state.server.registerResource(
				'Org and user details',
				'mcp://org/org-and-user-details.json',
				{
					title: 'Application Config',
					description: 'Org and user details',
					mimeType: 'application/json'
				},
				async uri => ({contents: [{uri: uri.href, text: JSON.stringify(result, null, 2)}]})
			);
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