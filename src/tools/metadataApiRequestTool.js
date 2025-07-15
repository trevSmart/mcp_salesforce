import {runCliCommand} from '../salesforceServices/runCliCommand.js';
import {loadToolDescription} from '../utils.js';

export const metadataApiRequestToolDefinition = {
	name: 'metadataApiRequest',
	title: 'Metadata API Request',
	description: loadToolDescription('metadataApiRequestTool'),
	inputSchema: {
		type: 'object',
		required: ['metadataType', 'targetUsername'],
		properties: {
			metadataType: {
				type: 'string',
				description: 'The type of metadata to retrieve'
			},
			targetUsername: {
				type: 'string',
				description: 'The username to retrieve metadata for'
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Request metadata from the Salesforce Metadata API'
	}
};

export async function metadataApiRequestTool({metadataType, targetUsername}) {
	try {
		const command = ['force:source:retrieve'];

		//Add the metadata type
		command.push('-m', metadataType);

		//If a username is specified, add it
		if (targetUsername) {
			command.push('-u', targetUsername);
		}

		//Execute the command
		const result = await JSON.parse(await runCliCommand(command.join(' ')));

		return {
			success: true,
			data: result,
			structuredContent: result
		};
	} catch (error) {
		throw new Error(`Error retrieving metadata: ${error.message}`);
	}
}

export default metadataApiRequestTool;