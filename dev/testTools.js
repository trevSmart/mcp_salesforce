import {callToolRequestSchemaHandler} from '../index.js';
import state from '../src/state.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

async function testTool(name, args, displayName, expectError = false) {
	const shownName = displayName || name;
	try {
		const request = {params: {name, arguments: args}};
		const result = await callToolRequestSchemaHandler(request);
		if (result && result.content && result.content[0] && result.content[0].type === 'text' && result.content[0].text) {
			if (expectError && result.isError) {
				process.stdout.write(`    ${shownName}... ${GREEN}OK (Expected error)${RESET}\n`);
				return true;
			} else if (!expectError && !result.isError) {
				process.stdout.write(`    ${shownName}... ${GREEN}OK${RESET}\n`);
				return true;
			}
		}
		//Si no és cap dels casos anteriors, és KO
		process.stdout.write(`    ${shownName}... ${RED}KO${RESET}\n`);
		if (result) {
			process.stdout.write(JSON.stringify(result, null, 2) + '\n');
		}
		return false;
	} catch (e) {
		process.stdout.write(`    ${shownName}... ${RED}KO${RESET}\n`);
		process.stdout.write((e && e.stack ? e.stack : JSON.stringify(e, null, 2)) + '\n');
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
		await testTool('getRecord', {sObjectName: 'Account', recordId: createdAccountId}, 'getRecord');
		await testTool('dmlOperation', {operation: 'update', sObjectName: 'Account', recordId: createdAccountId, fields: {Name: 'Test Account MCP Script Updated'}}, 'dmlOperation (update)');
		await testTool('dmlOperation', {operation: 'delete', sObjectName: 'Account', recordId: createdAccountId}, 'dmlOperation (delete)');
	}
}

async function main() {
	process.stdout.write('');
	process.stdout.write('');
	process.stdout.write('Waiting for server initialization...' + state.server.isConnected);
	process.stdout.write('');
	//Llista de proves paral·leles
	const parallelTestsList = [
		['getOrgAndUserDetails', {}],
		['executeSoqlQuery', {query: 'SELECT Id, Name FROM Account LIMIT 3', useToolingApi: false}],
		['describeObject', {sObjectName: 'Account'}],
		['executeAnonymousApex', {apexCode: 'System.debug(\'Hello World!\');'}],
		['getRecentlyViewedRecords', {}],
		['getSetupAuditTrail', {lastDays: 7, createdByName: ''}],
		['runApexTest', {classNames: [], methodNames: ['CSBD_Utils_Test.hexToDec']}],
		['getRecord', {sObjectName: 'Account', recordId: '001XXXXXXXXXXXXXXX'}, 'getRecord (inexistent)', true] //Prova d'id inexistent
	];

	const parallelTests = Promise.all(parallelTestsList.map(([name, args, displayName, expectError]) => testTool(name, args, displayName, expectError)));
	const sequentialTests = runSequentialTests();

	await Promise.all([parallelTests, sequentialTests]);
}

main()
.then(() => {
	process.stdout.write('Tests completed successfully');
	process.exit(0);

}).catch(error => {
	process.stdout.write(error.stack || error.message || error);
	process.exit(1);
});