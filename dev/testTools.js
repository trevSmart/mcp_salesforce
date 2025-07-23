import {readyPromise, setupServer} from	'../src/mcp-server.js';

//Import all tool functions
import {salesforceMcpUtilsTool} from '../src/tools/salesforceMcpUtilsTool.js';
import {getOrgAndUserDetailsTool} from '../src/tools/getOrgAndUserDetailsTool.js';
import {dmlOperationTool} from '../src/tools/dmlOperationTool.js';
import {deployMetadataTool} from '../src/tools/deployMetadataTool.js';
import {describeObjectTool} from '../src/tools/describeObjectTool.js';
import {executeAnonymousApexTool} from '../src/tools/executeAnonymousApexTool.js';
import {getRecentlyViewedRecordsTool} from '../src/tools/getRecentlyViewedRecordsTool.js';
import {getRecordTool} from '../src/tools/getRecordTool.js';
import {getSetupAuditTrailTool} from '../src/tools/getSetupAuditTrailTool.js';
import {executeSoqlQueryTool} from '../src/tools/executeSoqlQueryTool.js';
import {runApexTestTool} from '../src/tools/runApexTestTool.js';
import {apexDebugLogsTool} from '../src/tools/apexDebugLogsTool.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

const LOG_LEVEL_PRIORITY = {emergency: 0, alert: 1, critical: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7};

//Tool mapping - all tools
const toolFunctions = {
	salesforceMcpUtils: salesforceMcpUtilsTool,
	getOrgAndUserDetails: getOrgAndUserDetailsTool,
	dmlOperation: dmlOperationTool,
	deployMetadata: deployMetadataTool,
	describeObject: describeObjectTool,
	executeAnonymousApex: executeAnonymousApexTool,
	getRecentlyViewedRecords: getRecentlyViewedRecordsTool,
	getRecord: getRecordTool,
	getSetupAuditTrail: getSetupAuditTrailTool,
	executeSoqlQuery: executeSoqlQueryTool,
	runApexTest: runApexTestTool,
	apexDebugLogs: apexDebugLogsTool
};

//Intercept stdout to filter log messages by level
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
//Llista de patrons d'errors esperats per a proves amb expectError=true
const expectedErrorPatterns = [
	{
		tool: 'getRecord',
		pattern: /Error getting record 001XXXXXXXXXXXXXXX from object Account/
	}
	//Si cal, afegeix més patrons aquí
];

process.stdout.write = function(chunk, encoding, callback) {
	let text = chunk instanceof Buffer ? chunk.toString('utf8') : chunk;
	let printed = false;
	try {
		const json = JSON.parse(text);
		if (json && json.method === 'notifications/message' && json.params && json.params.level) {
			const level = json.params.level;
			const data = json.params.data || '';
			//Si és error, comprova si és un error esperat
			if (level === 'error') {
				const isExpected = expectedErrorPatterns.some(({pattern}) => pattern.test(data));
				if (isExpected) {
					//No imprimir l'error esperat
					return false;
				}
			}
			if (LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY['warning']) {
				originalStdoutWrite(chunk, encoding, callback);
				printed = true;
			}
			return printed;
		} else if (json && json.method) {
			//Qualsevol altre log JSON amb method: no imprimir
			return false;
		} else {
			//No és un log JSON, imprimir normal
			originalStdoutWrite(chunk, encoding, callback);
			printed = true;
		}
	} catch (e) {
		//No és JSON, imprimir normal
		originalStdoutWrite(chunk, encoding, callback);
		printed = true;
	}
	return printed;
};

async function testTool(name, args, displayName, expectError = false) {
	const shownName = displayName || name;
	try {
		const toolFunction = toolFunctions[name];
		if (!toolFunction) {
			process.stdout.write(`   ${CYAN}${shownName}${RESET}... ${RED}KO${RESET} (tool not found)\n`);
			return {success: false, result: null};
		}

		const result = await toolFunction(args);
		if (result && result.content && result.content[0] && result.content[0].type === 'text' && result.content[0].text) {
			if (expectError && result.isError) {
				process.stdout.write(`   ${CYAN}${shownName}${RESET}... ${GREEN}OK${RESET} (expected error)\n`);
				return {success: true, result};
			} else if (!expectError && !result.isError) {
				process.stdout.write(`   ${CYAN}${shownName}${RESET}... ${GREEN}OK${RESET}\n`);
				return {success: true, result};
			}
		}
		//Si no és cap dels casos anteriors, és KO
		process.stdout.write(`   ${CYAN}${shownName}${RESET}... ${RED}KO${RESET}\n`);
		if (result) {
			process.stdout.write(JSON.stringify(result, null, 3) + '\n');
		}
		return {success: false, result};
	} catch (e) {
		process.stdout.write(`   ${CYAN}${shownName}${RESET}... ${RED}KO${RESET}\n`);
		process.stdout.write((e && e.stack ? e.stack : JSON.stringify(e, null, 3)) + '\n');
		return {success: false, result: null, error: e};
	}
}

async function runSequentialTests() {
	let createdAccountId = null;
	const createTest = await testTool('dmlOperation', {operation: 'create', sObjectName: 'Account', fields: {Name: 'Test Account MCP Script'}}, 'Tool dmlOperation (create)');
	if (createTest.success && createTest.result && createTest.result.structuredContent && createTest.result.structuredContent.result) {
		createdAccountId = createTest.result.structuredContent.result.id || createTest.result.structuredContent.result.Id;
	}
	if (createdAccountId) {
		await testTool('getRecord', {sObjectName: 'Account', recordId: createdAccountId}, 'Tool getRecord');
		await testTool('dmlOperation', {operation: 'update', sObjectName: 'Account', recordId: createdAccountId, fields: {Name: 'Test Account MCP Script Updated'}}, 'Tool dmlOperation (update)');
		await testTool('dmlOperation', {operation: 'delete', sObjectName: 'Account', recordId: createdAccountId}, 'Tool dmlOperation (delete)');
	}
}

async function main() {
	process.stdout.write(GRAY + 'Initializing MCP server... ');
	await setupServer();
	process.stdout.write('done.\n');

	process.stdout.write(GRAY + 'Waiting for MCP server initialization... ');
	await readyPromise;
	process.stdout.write('done. Running tests...\n' + RESET);

	//Llista de proves paral·leles
	const parallelTestsList = [
		['runApexTest', {classNames: [], methodNames: ['CSBD_Utils_Test.hexToDec']}, 'Tool runApexTest'],
		['getOrgAndUserDetails', {}, 'Tool getOrgAndUserDetails'],
		['executeSoqlQuery', {query: 'SELECT Id, Name FROM Account LIMIT 3', useToolingApi: false}, 'Tool executeSoqlQuery'],
		['describeObject', {sObjectName: 'Account', include: 'all'}, 'Tool describeObject (all)'],
		['describeObject', {sObjectName: 'Account', include: 'fields'}, 'Tool describeObject (fields)'],
		['executeAnonymousApex', {apexCode: 'System.debug(\'Hello World!\');', mayModify: true}, 'Tool executeAnonymousApex'],
		['getRecentlyViewedRecords', {}, 'Tool getRecentlyViewedRecords'],
		['getSetupAuditTrail', {lastDays: 7, createdByName: ''}, 'Tool getSetupAuditTrail'],
		['getRecord', {sObjectName: 'Account', recordId: '001XXXXXXXXXXXXXXX'}, 'Tool getRecord (recordId inexistent)', true] //Prova d'id inexistent
	];

	const parallelTests = Promise.all(parallelTestsList.map(async ([name, args, displayName, expectError]) => {
		const result = await testTool(name, args, displayName, expectError);
		return result.success;
	}));
	const sequentialTests = runSequentialTests();

	await Promise.all([parallelTests, sequentialTests]);
}

main()
.then(() => process.stdout.write(GRAY + 'Finished running tests.\n\n' + RESET, () => process.exit(0)))
.catch(error => process.stdout.write((error.stack || error.message || error) + '\n', () => process.exit(1)));