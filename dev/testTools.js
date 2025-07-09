import {callToolRequestSchemaHandler} from '../index.js';
import {initServer} from '../src/utils.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

const originalConsoleLog = console.log;
const originalStdoutWrite = process.stdout.write;

async function testTool(name, args, displayName) {
	const shownName = displayName || name;
	try {
		const request = {params: {name, arguments: args}};
		const result = await callToolRequestSchemaHandler(request);
		if (!result.isError && result.content[0].type === 'text' && result.content[0].text && result.structuredContent) {
			originalStdoutWrite.call(process.stdout, `    ${shownName}... ${GREEN}OK${RESET}\n`);
		} else {
			originalStdoutWrite.call(process.stdout, `    ${shownName}... ${RED}KO${RESET}\n`);
			originalStdoutWrite.call(process.stdout, JSON.stringify(result, null, 2) + '\n');
		}
		return result;
	} catch (e) {
		originalStdoutWrite.call(process.stdout, `    ${shownName}... ${RED}KO${RESET}\n`);
		originalStdoutWrite.call(process.stdout, (e && e.stack ? e.stack : JSON.stringify(e, null, 2)) + '\n');
		return null;
	}
}

async function runSequentialTests() {
	let createdAccountId = null;
	const createResult = await testTool('dmlOperation', {operation: 'create', sObjectName: 'Account', fields: {Name: 'Test Account MCP Script'}}, 'dmlOperation (create)');
	if (createResult && createResult.structuredContent && createResult.structuredContent.result) {
		createdAccountId = createResult.structuredContent.result.id || createResult.structuredContent.result.Id;
	}

	if (createdAccountId) {
		await testTool('getRecord', {sObjectName: 'Account', recordId: createdAccountId});
		await testTool('dmlOperation', {operation: 'update', sObjectName: 'Account', recordId: createdAccountId, fields: {Name: 'Test Account MCP Script Updated'}}, 'dmlOperation (update)');
		await testTool('dmlOperation', {operation: 'delete', sObjectName: 'Account', recordId: createdAccountId}, 'dmlOperation (delete)');
	} else {
		originalConsoleLog(` ${RED}KO${RESET} Missing account id`);
	}
}

async function main() {
	try {
		const serverOk = await initServer();
		if (!serverOk) {
			originalConsoleLog('Warning: Server initialization returned false (no permissions), but continuing with tests...');
		}
	} catch (error) {
		originalConsoleLog('Warning: Failed to initialize server:', error.message);
		originalConsoleLog('Continuing with tests anyway...');
	}
	originalConsoleLog('');

	//Llista de proves paral·leles
	const parallelTestsList = [
		['getOrgAndUserDetails', {}],
		['executeSoqlQuery', {query: 'SELECT Id, Name FROM Account LIMIT 3', useToolingApi: false}],
		['describeObject', {sObjectName: 'Account'}],
		['executeAnonymousApex', {apexCode: 'System.debug(\'Hello World!\');'}],
		['getRecentlyViewedRecords', {}],
		['getSetupAuditTrail', {lastDays: 7, createdByName: ''}],
		['runApexTest', {classNames: [], methodNames: ['CSBD_Utils_Test.hexToDec']}]
	];

	const parallelTests = Promise.all(parallelTestsList.map(([name, args]) => testTool(name, args)));
	const sequentialTests = runSequentialTests();

	await Promise.all([parallelTests, sequentialTests]);
}

main().finally(() => {
	originalConsoleLog('');
	process.exit(0);
});