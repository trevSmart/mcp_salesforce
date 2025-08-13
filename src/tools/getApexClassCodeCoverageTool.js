import {getApexClassCodeCoverage} from '../salesforceServices.js';
import {log, textFileContent} from '../utils.js';
import {z} from 'zod';

export const getApexClassCodeCoverageToolDefinition = {
    name: 'getApexClassCodeCoverage',
    title: 'Get Apex Classes Code Coverage',
    description: textFileContent('getApexClassCodeCoverageTool'),
    inputSchema: {
        classNames: z
            .array(z.string())
            .describe('Case sensitive. Array of names of the Apex classes to get code coverage for. If you pass a single string, it will be treated as an array with a single element.')
    },
    annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
        title: 'Get Apex Classes Code Coverage'
    }
};

export async function getApexClassCodeCoverageTool({classNames}) {
    try {
        if (!classNames || !classNames.length) {
            throw new Error('classNames is required and must be a non-empty array of Apex class names');
        }

        const coverage = await getApexClassCodeCoverage(classNames);

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(coverage, null, 3)
            }],
            structuredContent: coverage
        };

    } catch (error) {
        log(error, 'error', `Error getting code coverage for classes ${Array.isArray(classNames) ? classNames.join(', ') : classNames}`);
        return {
            isError: true,
            content: [{
                type: 'text',
                text: error.message
            }],
            structuredContent: error
        };
    }
}


