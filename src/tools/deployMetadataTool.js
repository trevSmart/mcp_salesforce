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
		log('Server capabilities', 'debug');
		//let serverCapabilities = await state.server.getCapabilities();
		//log(JSON.stringify(serverCapabilities, null, 2), 'debug');
		const serverCapabilities = state.server.getCapabilities();
		log(JSON.stringify(serverCapabilities, null, 2), 'debug');

		if (serverCapabilities && 'elicitation' in serverCapabilities) {
			const elicitResult = await sendElicitRequest('Deploy metadata confirmation', `Are you sure you want to deploy this metadata to ${state.orgDescription.alias}?`);
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
		log(`Error deploying metadata file ${sourceDir}: ${JSON.stringify(error, null, 2)}`, 'error');
		return {
			isError: true,
			content: [{
				type: 'Error deploying metadata: ' + error.message,
				text: JSON.stringify(error, null, '\t')
			}]
		};
	}

}