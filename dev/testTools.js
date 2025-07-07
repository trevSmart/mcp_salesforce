import {callToolRequestSchemaHandler} from '../index.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

async function testTool(name, args, displayName) {
	//Guarda les referències originals
	const originalLog = console.log;
	const originalStdoutWrite = process.stdout.write;

	//Substitueix per funcions buides
	console.log = () => ({});
	process.stdout.write = () => true;

	//Mostra només la línia de test
	const shownName = displayName || name;
	originalStdoutWrite.call(process.stdout, `Testing tool ${shownName}... `);

	try {
		const request = {params: {name, arguments: args}};
		const result = await callToolRequestSchemaHandler(request);

		//Restaura la sortida
		console.log = originalLog;
		process.stdout.write = originalStdoutWrite;

		if (!result.isError && result.content[0].type === 'text' && result.content[0].text) {
			originalStdoutWrite.call(process.stdout, `${GREEN}OK${RESET}\n`);
		} else {
			originalStdoutWrite.call(process.stdout, `${RED}KO${RESET}\n`);
			//Mostra la sortida de la tool en cas de KO
			originalStdoutWrite.call(process.stdout, JSON.stringify(result, null, 2) + '\n');
		}
		return result;
	} catch (e) {
		//Restaura la sortida en cas d'error
		console.log = originalLog;
		process.stdout.write = originalStdoutWrite;
		originalStdoutWrite.call(process.stdout, `${RED}KO${RESET}\n`);
		//Mostra la sortida de l'error
		originalStdoutWrite.call(process.stdout, (e && e.stack ? e.stack : JSON.stringify(e, null, 2)) + '\n');
		return null;
	}
}

async function main() {
	console.log('');

	await testTool('getOrgAndUserDetails', {});

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
		console.log(` ${RED}KO${RESET} Missing account id`);
	}

	await testTool('executeSoqlQuery', {query: 'SELECT Id, Name FROM Account LIMIT 3', useToolingApi: false});

	await testTool('describeObject', {sObjectName: 'Account'});

	await testTool('executeAnonymousApex', {apexCode: 'System.debug(\'Hello World!\');'});

	await testTool('getRecentlyViewedRecords', {});

	await testTool('getSetupAuditTrail', {lastDays: 7, createdByName: ''});

	await testTool('runApexTest', {classNames: [], methodNames: ['CSBD_Utils_Test.listaCampo']});

	console.log('');
}

main().finally(() => process.exit(0));