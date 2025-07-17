import state from '../state.js';
import {deployMetadata} from '../salesforceServices/deployMetadata.js';
import {log, loadToolDescription, sendElicitRequest} from '../utils.js';

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
		if (state.client.capabilities?.elicitation) {
			const elicitResult = await sendElicitRequest({
				confirmation: {
					type: 'string',
					title: 'Deploy metadata confirmation',
					description: `Are you sure you want to deploy this metadata to ${state.org.alias}?`,
					enum: ['Yes', 'No'],
					enumNames: [`✅ Deploy metadata to ${state.org.alias}`, '❌ Don\'t deploy']
				}
			});
			if (elicitResult.action !== 'accept' || elicitResult.content?.confirmation !== 'Yes') {
				return {
					content: [{
						type: 'text',
						text: 'Deployment cancelled by user'
					}]
				};
			}
		}

		const result = await deployMetadata(sourceDir);
		return {
			content: [{
				type: 'text',
				text: JSON.stringify(result, null, '\t')
			}],
			structuredContent: result
		};

	} catch (error) {
		log(`Error deploying metadata file "${sourceDir}": ${error.message}`, 'error');
		return {
			isError: true,
			content: [{
				type: 'Error deploying metadata: ' + error.message,
				text: JSON.stringify(error, null, '\t')
			}]
		};
	}

}