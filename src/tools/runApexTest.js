//import {TestService, TestLevel} from '@salesforce/apex-node';
import {runApexTest} from '../salesforceServices/runApexTest.js';
import {classNamesSchema, methodNamesSchema} from './paramSchemas.js';
import {z} from 'zod';
import {log, loadToolDescription} from '../utils.js';

export const runApexTestToolDefinition = {
	name: 'runApexTest',
	title: 'Run Apex Test',
	description: loadToolDescription('runApexTest'),
	inputSchema: {
		type: 'object',
		required: [],
		properties: {
			classNames: {
				type: 'array',
				items: {type: 'string'},
				description: 'Names of the Apex test classes to run.'
			},
			methodNames: {
				type: 'array',
				items: {type: 'string'},
				description: 'Names of the test methods to run (optional).'
			}
		}
	},
	annotations: {
		testHint: true,
		destructiveHint: true,
		readOnlyHint: false,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Run Apex Test'
	}
};

/**
 * Executes Apex test classes (and optionally methods) using @salesforce/apex-node.
 * @param {Object} args - Tool arguments
 * @param {string[]} args.classNames - Names of the Apex test classes
 * @param {string[]} [args.methodNames] - Names of the test methods (optional)
 * @returns {Promise<Object>} Test result
 */
export async function runApexTestTool(params) {
	try {

		const schema = z.object({
			classNames: classNamesSchema.optional(),
			methodNames: methodNamesSchema.optional()
		});
		const parseResult = schema.safeParse(params);
		if (!parseResult.success) {
			return {
				isError: true,
				content: [{
					type: 'text',
					text: `❌ Error de validació: ${parseResult.error.message}`
				}]
			};
		}

		let result;
		if (params.methodNames && params.methodNames.length) {
			//Cas B: només mètodes concrets, ignora classNames
			result = await runApexTest([], params.methodNames);

		} else if (params.classNames && params.classNames.length) {
			//Cas A: només classes senceres, ignora methodNames
			result = await runApexTest(params.classNames, []);

		} else {
			throw new Error('Cal especificar classNames o methodNames.');
		}

		result = {result};
		return {
			content: [{
				type: 'text',
				text: JSON.stringify(result, null, 2)
			}],
			structuredContent: result
		};

	} catch (error) {
		log('Error executant runApexTest:', 'error');
		log(error, 'error');

		return {
			isError: true,
			content: [{
				type: 'text',
				text: error.message
			}]
		};
	}
}