import {mcpServer, resources, sendElicitRequest} from '../mcp-server.js';
import client from '../client.js';
import {runApexTest, executeSoqlQuery} from '../salesforceServices.js';
import {log, textFileContent, notifyProgressChange} from '../utils.js';
import {z} from 'zod';

export const runApexTestToolDefinition = {
	name: 'runApexTest',
	title: 'Run Apex Tests',
	description: textFileContent('runApexTestTool'),
	inputSchema: {
		classNames: z
			.array(z.string())
			.optional()
			.describe('Names of the Apex test classes to run (all tests in the classes will be run).'),
		methodNames: z
			.array(z.string())
			.optional()
			.describe('Test methods to run with the format "testClassName.testMethodName" (only the specified methods will be run).')
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
	if ('Apex test classes list' in resources) {
		return resources['Apex test classes list'].contents[0].text; //PENDENT
	}

	const soqlQuery = 'SELECT Name, Body FROM ApexClass WHERE NamespacePrefix = NULL AND Status = \'Active\' ORDER BY Name';
	const classes = (await executeSoqlQuery(soqlQuery)).records;
	const testClasses = classes.filter(r => r.Body.toLowerCase().includes('@istest'));
	const testClassNames = testClasses.map(r => r.Name);

	resources['Apex test classes list'] = {
		title: 'Apex test classes list',
		description: 'Apex test classes list',
		mimeType: 'text/plain',
		contents: [{uri: 'mcp://org/apex-test-classes-list.txt', text: testClassNames.join('\n')}]
	};

	if (client.supportsCapability('resources')) {
		mcpServer.server.registerResource(
			'Apex test classes list',
			'mcp://org/apex-test-classes-list.txt',
			{
				title: 'Apex test classes list',
				description: 'Apex test classes list',
				mimeType: 'text/plain'
			},
			async uri => ({contents: [{uri: uri.href, text: testClassNames.join('\n')}]})
		);
	}

	const elicitResult = await sendElicitRequest({
		confirmation: {
			type: 'string',
			title: 'Select the Apex test class to run (all its methods will be evaluated).',
			description: 'Select the Apex class to test.',
			enum: testClassNames,
			enumNames: testClassNames
		}
	});
	if (elicitResult.action !== 'accept' || !elicitResult.content?.confirmation) {
		return {
			content: [{type: 'text', text: 'Script execution cancelled by user'}]
		};
	} else {
		return elicitResult.content.confirmation;
	}
}

export async function runApexTestTool({classNames = [], methodNames = []}, _meta) {
	try {
		if (!classNames.length && !methodNames.length) {
			classNames = [await classNameElicitation()];
		}

		let testRunId;
		if (methodNames && methodNames.length) {
			//Cas B: només mètodes concrets, ignora classNames
			testRunId = await runApexTest([], methodNames);

		} else if (classNames && classNames.length) {
			//Cas A: només classes senceres, ignora methodNames
			testRunId = await runApexTest(classNames, []);

		} else {
			throw new Error('Cal especificar classNames o methodNames.');
		}

		if (!testRunId) {
			throw new Error('No s\'ha obtingut testRunId del salesforceService');
		}

		const progressToken = classNames?.length > 1 ? _meta?.progressToken : null;
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
			await new Promise(resolve => setTimeout(resolve, 8000)); //Polling cada 8 segons
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