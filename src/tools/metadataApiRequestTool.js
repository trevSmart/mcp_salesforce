import {runCliCommand} from '../salesforceServices.js';
import {textFileContent, log} from '../utils.js';
import {z} from 'zod';

export const metadataApiRequestToolDefinition = {
	name: 'metadataApiRequest',
	title: 'Metadata API Request',
	description: textFileContent('metadataApiRequestTool'),
	inputSchema: {
		metadataType: z
			.string()
			.describe('The type of metadata to retrieve'),
		targetUsername: z
			.string()
			.describe('The username to retrieve metadata for')
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
		const command = `force:source:retrieve -m ${metadataType} -u ${targetUsername}`;
		const resultString = await runCliCommand(command);

		let result;
		try {
			result = JSON.parse(resultString);
		} catch (error) {
			throw new Error(`Error parsing JSON response: ${resultString}`);
		}

		return {
			content: [{
				type: 'text',
				text: JSON.stringify(result, null, '3')
			}],
			structuredContent: result
		};

	} catch (error) {
		log(error, 'error');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: '❌ Error retrieving metadata: ' + error.message
			}]
		};
	}
}

export default metadataApiRequestTool;