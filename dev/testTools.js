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
import {exec} from 'child_process';
import {promisify} from 'util';

const execAsync = promisify(exec);

//Constants for Salesforce org management
const REQUIRED_ORG_ALIAS = 'DEVSERVICE';
let originalOrgAlias = null;

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const YELLOW = '\x1b[33m';

const LOG_LEVEL_PRIORITY = {emergency: 0, alert: 1, critical: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7};

//Salesforce org management functions
async function getCurrentOrgAlias() {
	try {
		const {stdout} = await execAsync('sf config get target-org --json');
		const config = JSON.parse(stdout);
		return config.result[0]?.value || null;
	} catch (error) {
		console.error(`${RED}Error getting current org:${RESET}`, error.message);
		return null;
	}
}

async function setTargetOrg(orgAlias) {
	try {
		await execAsync(`sf config set target-org "${orgAlias}" --global --json`);
		process.stdout.write(`${YELLOW}Switched to org: ${orgAlias}${RESET}\n`);
		return true;
	} catch (error) {
		console.error(`${RED}Error setting target org:${RESET}`, error.message);
		return false;
	}
}

async function setupSalesforceOrg() {
	const currentOrg = await getCurrentOrgAlias();

	if (currentOrg === REQUIRED_ORG_ALIAS) {
		process.stdout.write(`${GREEN}Already connected to required org: ${REQUIRED_ORG_ALIAS}${RESET}\n`);
		originalOrgAlias = null; //No need to restore
		return true;
	}

	process.stdout.write(`${YELLOW}Current org: ${currentOrg || 'none'}${RESET}\n`);
	process.stdout.write(`${YELLOW}Switching to required org: ${REQUIRED_ORG_ALIAS}${RESET}\n`);

	//Save original org
	originalOrgAlias = currentOrg;

	//Switch to required org
	const success = await setTargetOrg(REQUIRED_ORG_ALIAS);
	if (!success) {
		process.stdout.write(`${RED}Failed to switch to required org. Tests may fail.${RESET}\n`);
		return false;
	}

	return true;
}

async function restoreOriginalOrg() {
	if (originalOrgAlias === null) {
		return; //No need to restore
	}

	process.stdout.write(`${YELLOW}Restoring original org: ${originalOrgAlias}${RESET}\n`);
	await setTargetOrg(originalOrgAlias);
}

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
	},
	{
		tool: 'getRecord',
		pattern: /Command failed: sf data get record --sobject Account --record-id 001XXXXXXXXXXXXXXX --json/
	},
	{
		tool: 'getRecord',
		pattern: /Provided external ID field does not exist or is not accessible: 001XXXXXXXXXXXXXXX/
	},
	{
		tool: 'getRecord',
		pattern: /\(👁🐝Ⓜ️\)\s*Error running SF CLI command: Command failed: sf data get record --sobject Account --record-id 001XXXXXXXXXXXXXXX --json/
	},
	{
		tool: 'getRecord',
		pattern: /\(👁🐝Ⓜ️\)\s*Error getting record 001XXXXXXXXXXXXXXX from object Account: Command failed: sf data get record --sobject Account --record-id 001XXXXXXXXXXXXXXX --json/
	},
	{
		tool: 'getRecord',
		pattern: /\(👁🐝Ⓜ️\)\s*\{.*"name": "NOT_FOUND".*"Provided external ID field does not exist or is not accessible: 001XXXXXXXXXXXXXXX".*\}/
	}
	//Si cal, afegeix més patrons aquí
];

//Variable global per controlar si estem en una prova amb error esperat
let currentTestExpectsError = false;

process.stdout.write = function(chunk, encoding, callback) {
	let text = chunk instanceof Buffer ? chunk.toString('utf8') : chunk;
	let printed = false;

	//Si estem esperant un error, comprova si aquest text conté un error esperat
	if (currentTestExpectsError) {
		const isExpectedError = expectedErrorPatterns.some(({pattern}) => pattern.test(text));
		if (isExpectedError) {
			//No imprimir l'error esperat
			return false;
		}
	}

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

	//Activa el flag per errors esperats
	currentTestExpectsError = expectError;

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
	} finally {
		//Desactiva el flag després de la prova
		currentTestExpectsError = false;
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
	process.stdout.write(GRAY + 'Setting up Salesforce org... ');

	//Setup Salesforce org before running tests
	const orgSetupSuccess = await setupSalesforceOrg();
	if (!orgSetupSuccess) {
		process.stdout.write(`${RED}Failed to setup Salesforce org. Exiting.${RESET}\n`);
		process.exit(1);
	}

	process.stdout.write('done.\n');

	process.stdout.write(GRAY + 'Waiting for MCP server initialization... ');
	await setupServer();
	await readyPromise;
	process.stdout.write('done. Running tests...\n' + RESET);

	//Llista de proves paral·leles
	const parallelTestsList = [
		['runApexTest', {classNames: [], methodNames: ['CSBD_Utils_Test.hexToDec']}, 'Tool runApexTest'],
		['getOrgAndUserDetails', {}, 'Tool getOrgAndUserDetails'],
		['executeSoqlQuery', {query: 'SELECT Id, Name FROM Account LIMIT 3', useToolingApi: false}, 'Tool executeSoqlQuery'],
		['executeSoqlQuery', {query: 'SELECT Id FROM TraceFlag LIMIT 3', useToolingApi: true}, 'Tool executeSoqlQuery (with tooling API)'],
		['describeObject', {sObjectName: 'Account', include: 'all'}, 'Tool describeObject (all)'],
		['describeObject', {sObjectName: 'Account', include: 'fields'}, 'Tool describeObject (fields)'],
		['executeAnonymousApex', {apexCode: 'System.debug(\'Hello World!\');', mayModify: true}, 'Tool executeAnonymousApex'],
		['getRecentlyViewedRecords', {}, 'Tool getRecentlyViewedRecords'],
		['getSetupAuditTrail', {lastDays: 1}, 'Tool getSetupAuditTrail (last day)'],
		['getSetupAuditTrail', {lastDays: 7, createdByName: 'Marc Pla'}, 'Tool getSetupAuditTrail (last week, filter by user)'],
		['getSetupAuditTrail', {lastDays: 7, metadataName: 'CSBD_Utils'}, 'Tool getSetupAuditTrail (last week, filter by metadata)'],
		['getRecord', {sObjectName: 'Account', recordId: '001XXXXXXXXXXXXXXX'}, 'Tool getRecord (recordId inexistent)', true], //Prova d'id inexistent
		['salesforceMcpUtils', {action: 'getState'}, 'Tool salesforceMcpUtils (getState)']
	];

	const parallelTests = Promise.all(parallelTestsList.map(async ([name, args, displayName, expectError]) => {
		const result = await testTool(name, args, displayName, expectError);
		return result.success;
	}));
	const sequentialTests = runSequentialTests();

		await Promise.all([parallelTests, sequentialTests]);

	//Restore original org after tests (only if we changed it)
	if (originalOrgAlias !== null) {
		process.stdout.write(GRAY + 'Restoring original Salesforce org... ');
		await restoreOriginalOrg();
		process.stdout.write('done.\n' + RESET);
	}
}

main()
.then(() => process.stdout.write(GRAY + 'Finished running tests.\n\n' + RESET, () => process.exit(0)))
.catch(async (error) => {
	//Ensure we restore the original org even if tests fail (only if we changed it)
	if (originalOrgAlias !== null) {
		process.stdout.write(GRAY + 'Restoring original Salesforce org after error... ');
		await restoreOriginalOrg();
		process.stdout.write('done.\n' + RESET);
	}

	process.stdout.write((error.stack || error.message || error) + '\n', () => process.exit(1));
});