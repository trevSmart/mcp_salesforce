import {generateMetadata} from '../salesforceServices.js';
import {log, textFileContent} from '../utils.js';
import {z} from 'zod';

export const createMetadataToolDefinition = {
	name: 'createMetadata',
	title: 'Create Metadata (Apex Class, Apex Test Class, Apex Trigger or LWC)',
	description: textFileContent('createMetadata'),
	inputSchema: {
		type: z.enum(['apexClass', 'apexTestClass', 'apexTrigger', 'lwc'])
			.describe('The metadata type to generate: "apexClass", "apexTestClass", "apexTrigger" or "lwc".'),
		name: z.string()
			.describe('Name of the metadata to generate. For LWC, this will be the component folder name.'),
		outputDir: z.string()
			.optional()
			.describe('Optional. Output directory relative to the workspace. Defaults depend on the type.'),
		sobjectName: z.string()
			.optional()
			.describe('Required for apexTrigger. The sObject API name the trigger is defined on. For LWC, this will be the component folder name.'),
		events: z.array(z.string())
			.optional()
			.describe('Optional for apexTrigger. Trigger events. Example: ["beforeInsert", "afterUpdate"].')
	},
	annotations: {
		readOnlyHint: false,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Create Metadata (Apex Class, Apex Test Class, Apex Trigger or LWC)'
	}
};

export async function createMetadataToolHandler({type, name, outputDir, sobjectName, events = []}) {
	try {
		const result = await generateMetadata({type, name, outputDir, sobjectName, events});

		return {
			content: [{
				type: 'text',
				text: JSON.stringify(result, null, 3)
			}],
			structuredContent: result
		};

	} catch (error) {
		log(error, 'error', 'Error creating metadata');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: '❌ ' + error.message
			}],
			structuredContent: {success: false, error: error.message}
		};
	}
}


