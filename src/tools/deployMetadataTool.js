import {deployMetadata} from '../salesforceServices/deployMetadata.js';
import {log, loadToolDescription} from '../utils.js';

export const deployMetadataToolDefinition = {
	name: 'deployMetadata',
	title: 'Deploy Metadata',
	description: loadToolDescription('deployMetadataTool'),
	inputSchema: {
		type: 'object',
		required: ['sourceDir'],
		properties: {
			sourceDir: {
				type: 'string',
				description: 'The path to the local metadata file to deploy.',
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Deploy Metadata'
	}
};

export async function deployMetadataTool({sourceDir}) {
	try {
		const result = await deployMetadata({sourceDir});
		return {
			content: [{
				type: 'text',
				text: JSON.stringify(result, null, '\t')
			}],
			structuredContent: result
		};
	} catch (error) {
		log(`Error deploying metadata file ${sourceDir}: ${JSON.stringify(error, null, 2)}`);
		return {
			isError: true,
			content: [{
				type: 'text',
				text: JSON.stringify(error, null, '\t')
			}]
		};
	}
}