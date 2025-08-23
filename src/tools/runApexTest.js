import {mcpServer, resources, newResource} from '../mcp-server.js';
import client from '../client.js';
import {runApexTest, executeSoqlQuery} from '../salesforceServices.js';
import {log, textFileContent} from '../utils.js';
import {z} from 'zod';

export const runApexTestToolDefinition = {
	name: 'runApexTest',
	title: 'Run Apex Tests',
	description: textFileContent('runApexTest'),
	inputSchema: {
		classNames: z
			.array(z.string())
			.optional()
			.describe('Case sensitive. Names of the Apex test classes to run (all tests in the classes will be run).'),
		methodNames: z
			.array(z.string())
			.optional()
			.describe('Test methods to run with the format "testClassName.testMethodName" (only the specified methods will be run).'),
		suiteNames: z
			.array(z.string())
			.optional()
			.describe('Case sensitive. Names of the Apex test suites to run (all classes in the suites will be run).')
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

async function classNameElicitation() {
	let testClasses = [];
	if ('mcp://mcp/apex-test-classes-list.txt' in resources) {
		testClasses = JSON.parse(resources['mcp://mcp/apex-test-classes-list.txt'].text);
	} else {
		const soqlQuery = 'SELECT Name, Body, FORMAT(LastModifiedDate), LastModifiedBy.Name FROM ApexClass WHERE NamespacePrefix = NULL AND Status = \'Active\'';
		const classes = (await executeSoqlQuery(soqlQuery)).records;
		testClasses = classes.filter(r => r.Body.toLowerCase().includes('@istest')).map(r => ({
			name: r.Name, description: `${r.LastModifiedBy.Name} · ${r.LastModifiedDate}`
		}));
		testClasses = testClasses.sort((a, b) => a.name.localeCompare(b.name));
		newResource(
			'mcp://mcp/apex-test-classes-list.txt',
			'Apex test classes list',
			'Apex test classes list',
			'text/plain',
			JSON.stringify(testClasses, null, 3),
			{audience: ['assistant']}
		);
	}

	return await mcpServer.server.elicitInput({
		message: 'Please select the Apex test class to run (all its methods will be executed).',
		requestedSchema: {
			type: 'object',
			title: 'Select the Apex test class to run (all its methods will be executed).',
			properties: {
				confirm: {
					type: 'string',
					enum: testClasses.map(r => r.name),
					enumNames: testClasses.map(r => r.description),
					description: 'Select the Apex class to run.'
				}
			},
			required: ['confirm']
		}
	});
}

export async function runApexTestToolHandler({classNames = [], methodNames = [], suiteNames = []}) {
	try {
		// Validate that only one input array has items
		const hasClassNames = classNames && classNames.length > 0;
		const hasMethodNames = methodNames && methodNames.length > 0;
		const hasSuiteNames = suiteNames && suiteNames.length > 0;

		const inputCount = [hasClassNames, hasMethodNames, hasSuiteNames].filter(Boolean).length;
		if (inputCount > 1) {
			throw new Error('You can only specify one input type: either classNames, methodNames, or suiteNames. Multiple input types are not allowed.');
		}

		if (!classNames.length && !methodNames.length && !suiteNames.length) {
			if (client.supportsCapability('elicitation')) {
				const elicitResult = await classNameElicitation();
				const selectedClassName = elicitResult.content?.confirm;
				if (elicitResult.action !== 'accept' || !selectedClassName) {
					return {
						content: [{
							type: 'text',
							text: 'User has cancelled the Apex test run'
						}],
						structuredContent: elicitResult
					};
				}
				classNames = [selectedClassName];
			} else {
				throw new Error('Test class/method name required');
			}
		} else {
			classNames = classNames.filter(className => typeof className === 'string');
			methodNames = methodNames.filter(methodName => typeof methodName === 'string');
			suiteNames = suiteNames.filter(suiteName => typeof suiteName === 'string');
		}

		let testRunId;
		if (methodNames && methodNames.length) {
			//Cas B: només mètodes concrets, ignora classNames
			testRunId = await runApexTest([], methodNames, []);

		} else if (classNames && classNames.length) {
			//Cas A: només classes senceres, ignora methodNames
			testRunId = await runApexTest(classNames, [], []);

		} else if (suiteNames && suiteNames.length) {
			//Cas C: només suites senceres, ignora classNames i methodNames
			testRunId = await runApexTest([], [], suiteNames);

		} else {
			throw new Error('You need to specify classNames, methodNames or suiteNames.');
		}

		if (!testRunId) {
			throw new Error('No test run Id returned by Salesforce CLI');
		}

		//const progressToken = classNames?.length > 1 ? _meta?.progressToken : null;
		//Polling per esperar que el test acabi
		let testRunResult;
		while (true) {
			const testRunResults = await executeSoqlQuery(`SELECT Id, Status, StartTime, TestTime, TestSetupTime, ClassesEnqueued, ClassesCompleted, MethodsEnqueued, MethodsCompleted, MethodsFailed FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`);
			testRunResult = testRunResults.records[0];

			if (!testRunResult || testRunResult.Status !== 'Processing' && testRunResult.Status !== 'Queued') {
				//notifyProgressChange(progressToken, testRunResult.MethodsEnqueued, testRunResult.MethodsEnqueued, 'Test finalitzat');
				break;
			}
			//const progress = testRunResult.MethodsCompleted + testRunResult.MethodsFailed;
			//notifyProgressChange(progressToken, testRunResult.MethodsEnqueued, progress, 'Executant el test...');
			await new Promise(resolve => setTimeout(resolve, 8000)); //Polling every 8 seconds
		}

		// Verify that we have a valid testRunResult before proceeding
		if (!testRunResult || !testRunResult.Id) {
			throw new Error('No valid test run result found. The test may have failed to start or complete.');
		}

		//Obtenir els resultats finals dels tests
		const testResults = await executeSoqlQuery(`SELECT ApexClass.Name, MethodName, Outcome, RunTime, Message, StackTrace FROM ApexTestResult WHERE ApexTestRunResultId = '${testRunResult.Id}'`);

		if (!Array.isArray(testResults.records)) {
			throw new Error('The result of executeSoqlQuery does not contain an array of records. Received value: ' + JSON.stringify(testResults));
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
				text: 'Render in table format: ' + JSON.stringify(result)
			}],
			structuredContent: result
		};

	} catch (error) {
		log(error, 'error');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: JSON.stringify(error, null, 3)
			}]
		};
	}
}