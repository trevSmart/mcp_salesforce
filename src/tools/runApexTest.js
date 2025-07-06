import {salesforceState} from '../state.js';
import {TestService, TestLevel} from '@salesforce/apex-node';
import {Connection, AuthInfo} from '@salesforce/core';
import {classNameSchema, methodNameSchema} from './paramSchemas.js';
import {z} from 'zod';
import {loadToolDescription} from '../utils.js';

export const runApexTestToolDefinition = {
	name: 'runApexTest',
	title: 'Run Apex Test',
	description: loadToolDescription('runApexTest'),
	inputSchema: {
		type: 'object',
		required: ['className'],
		properties: {
			className: {
				type: 'string',
				description: 'Name of the Apex test class to run.'
			},
			methodName: {
				type: 'string',
				description: 'Name of the test method to run (optional).'
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
 * Executes an Apex test class (and optionally a method) using @salesforce/apex-node.
 * @param {Object} args - Tool arguments
 * @param {string} args.className - Name of the Apex test class
 * @param {string} [args.methodName] - Name of the test method (optional)
 * @returns {Promise<Object>} Test result
 */
export async function runApexTestTool(params) {
	const schema = z.object({
		className: classNameSchema,
		methodName: methodNameSchema,
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

	try {
		const authInfo = await AuthInfo.create({username: salesforceState.orgDescription.userName});
		const connection = await Connection.create({authInfo});
		let tests;
		try {
			if (params.methodName) {
				tests = [{className: params.className, testMethods: [params.methodName]}];
			} else {
				tests = [{className: params.className}];
			}
		} catch (error) {
			return {
				isError: true,
				content: [{
					type: 'text',
					text: `❌ Error de preparació de tests: ${error.message}`
				}]
			};
		}
		const testService = new TestService(connection);
		const result = await testService.runTestAsynchronous({
			testLevel: TestLevel.RunSpecifiedTests,
			tests,
		}, false /*without code coverage */);

		return {
			jobId: result?.summary?.testRunId || result?.testRunId,
			content: [{
				type: 'text',
				text: JSON.stringify(result, null, 2)
			}],
			structuredContent: {
				result: result
			}
		};
	} catch (error) {
		let errorMsg;
		if (error?.data?.message) {
			errorMsg = `❌ Error executant runApexTest: ${error.data.message}`;
		} else {
			errorMsg = `❌ Error executant runApexTest: ${error.message}`;
		}
		return {
			isError: true,
			content: [{
				type: 'text',
				text: errorMsg
			}]
		};
	}
}