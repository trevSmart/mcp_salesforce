import {getApexClassCodeCoverage} from '../salesforceServices.js';
import {log, textFileContent} from '../utils.js';
import {z} from 'zod';

export const getApexClassCodeCoverageToolDefinition = {
    name: 'getApexClassCodeCoverage',
    title: 'Get Apex Class Code Coverage',
    description: textFileContent('getApexClassCodeCoverageTool'),
    inputSchema: {
        className: z
            .string()
            .describe('Case sensitive. Name of the Apex class to get code coverage for.')
    },
    annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
        title: 'Get Apex Class Code Coverage'
    }
};

export async function getApexClassCodeCoverageTool({className}) {
    try {
        if (!className || typeof className !== 'string') {
            throw new Error('className is required and must be a string');
        }

        const coverage = await getApexClassCodeCoverage(className);

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(coverage, null, 3)
            }],
            structuredContent: coverage
        };

    } catch (error) {
        log(error, 'error');
        const errorContent = {error: true, message: error.message};
        return {
            isError: true,
            content: [{
                type: 'text',
                text: JSON.stringify(errorContent)
            }],
            structuredContent: errorContent
        };
    }
}


