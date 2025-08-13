import { generateMetadata } from '../salesforceServices.js';
import { log, textFileContent } from '../utils.js';
import { z } from 'zod';

export const createMetadataToolDefinition = {
    name: 'createMetadata',
    title: 'Create Metadata (Apex Class, Apex Trigger or LWC)',
    description: textFileContent('createMetadataTool'),
    inputSchema: {
        type: z
            .enum(['apexClass', 'apexTrigger', 'lwc'])
            .describe('The metadata type to generate: "apexClass", "apexTrigger" or "lwc"'),
        name: z
            .string()
            .describe('Name of the metadata to generate. For LWC, this will be the component folder name.'),
        outputDir: z
            .string()
            .optional()
            .describe('Optional. Output directory relative to the workspace. Defaults depend on the type.'),
        sobjectName: z
            .string()
            .optional()
            .describe('Required for apexTrigger. The sObject API name the trigger is defined on.'),
        events: z
            .array(z.string())
            .optional()
            .describe('Optional for apexTrigger. Trigger events. Example: ["beforeInsert", "afterUpdate"].'),
        template: z
            .string()
            .optional()
            .describe('Optional template name for Apex artifacts (e.g., DefaultApexClass, DefaultApexTrigger).')
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: 'Create project metadata'
    }
};

export async function createMetadataTool({ type, name, outputDir, sobjectName, events = [], template }) {
    try {
        const result = await generateMetadata({ type, name, outputDir, sobjectName, events, template });

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
            structuredContent: { success: false, error: error.message }
        };
    }
}


