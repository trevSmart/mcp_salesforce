//import {TestService, TestLevel} from '@salesforce/apex-node';
import {runApexTest} from '../salesforceServices/runApexTest.js';
import {executeSoqlQuery} from '../salesforceServices/executeSoqlQuery.js';
import {classNamesSchema, methodNamesSchema} from './paramSchemas.js';
import {z} from 'zod';
import {log, loadToolDescription, notifyProgressChange} from '../utils.js';

export const runApexTestToolDefinition = {
	name: 'runApexTest',
	title: 'Run Apex Tests',
	description: loadToolDescription('runApexTest'),
	inputSchema: {
		type: 'object',
		required: [],
		properties: {
			classNames: {
				type: 'array',
				items: {type: 'string'},
				description: 'Names of the Apex test classes to run (all tests in the classes will be run).'
			},
			methodNames: {
				type: 'array',
				items: {type: 'string'},
				description: 'Test methods to run with the format "testClassName.testMethodName" (only the specified methods will be run).'
			}
		}
	},
	annotations: {
		testHint: true,
		destructiveHint: true,
		readOnlyHint: false,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Run Apex Tests'
	}
};

/**
 * Executes Apex test classes (and optionally methods) using @salesforce/apex-node.
 * @param {Object} args - Tool arguments
 * @param {string[]} args.classNames - Names of the Apex test classes
 * @param {string[]} [args.methodNames] - Names of the test methods (optional)
 * @returns {Promise<Object>} Test result
 */
export async function runApexTestTool(params, _meta) {
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

		let testRunId;
		if (params.methodNames && params.methodNames.length) {
			//Cas B: només mètodes concrets, ignora classNames
			testRunId = await runApexTest([], params.methodNames);

		} else if (params.classNames && params.classNames.length) {
			//Cas A: només classes senceres, ignora methodNames
			testRunId = await runApexTest(params.classNames, []);

		} else {
			throw new Error('Cal especificar classNames o methodNames.');
		}

		if (!testRunId) {
			throw new Error('No s\'ha obtingut testRunId del salesforceService');
		}

		const progressToken = params.classNames.length > 1 ? _meta.progressToken : null;
		//Polling per esperar que el test acabi
		let testRunResult;
		while (true) {
			const testRunResults = await executeSoqlQuery(`SELECT Id, Status, StartTime, TestTime, TestSetupTime, ClassesEnqueued, ClassesCompleted, MethodsEnqueued, MethodsCompleted, MethodsFailed FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`);
			testRunResult = testRunResults.records[0];
			if (!testRunResult || testRunResult.Status !== 'Processing' && testRunResult.Status !== 'Queued') {
				notifyProgressChange(progressToken, testRunResult.MethodsEnqueued, testRunResult.MethodsEnqueued, 'Test finalitzat');
				break;
			}
			const progress = testRunResult.MethodsCompleted + testRunResult.MethodsFailed;
			notifyProgressChange(progressToken, testRunResult.MethodsEnqueued, progress, 'Executant el test...');
			await new Promise(resolve => setTimeout(resolve, 8000)); //Espera 8 segons
		}

		//Obtenir els resultats finals dels tests
		const testResults = await executeSoqlQuery(`SELECT ApexClass.Name, MethodName, Outcome, RunTime, Message, StackTrace FROM ApexTestResult WHERE ApexTestRunResultId = '${testRunResult.Id}'`);

		if (!Array.isArray(testResults.records)) {
			throw new Error('El resultado de executeSoqlQuery no contiene un array de records. Valor recibido: ' + JSON.stringify(testResults));
		}

		let result = testResults.records.map(r => ({
			className: r.ApexClass?.Name,
			methodName: r.MethodName,
			status: r.Outcome,
			runtime: r.RunTime,
			message: r.Message,
			stackTrace: r.StackTrace
		}));
		result = {result};
		return {
			content: [{
				type: 'text',
				text: 'Render in table: ' + JSON.stringify(result)
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