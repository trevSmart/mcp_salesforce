import {execSync} from 'child_process';
import {testToolHandler} from '../index.js';
import {log} from '../src/utils.js';

const tools = [
	{name: 'soqlQuery', args: {query: 'SELECT Id, Name FROM Account LIMIT 5'}}
	/*
	{name: 'orgDetails', importPath: '../src/tools/orgDetails.js'},
	{name: 'generateSoqlQuery', importPath: '../src/tools/generateSoqlQuery.js', args: {soqlQueryDescription: 'Llista tots els comptes', involvedSObjects: ['Account']}},
	{name: 'describeObject', importPath: '../src/tools/describeObject.js', args: {sObjectName: 'Account'}},
	{name: 'currentUserDetails', importPath: '../src/tools/currentUserDetails.js'},
	{name: 'apexDebugLogs', importPath: '../src/tools/apexDebugLogs.js', args: {action: 'status'}},
	{name: 'createRecord', importPath: '../src/tools/createRecord.js', args: {sObjectName: 'Account', fields: {Name: 'Test MCP'}}},
	{name: 'deleteRecord', importPath: '../src/tools/deleteRecord.js', args: {sObjectName: 'Account', recordId: '001KN000006KDuKYAW'}},
	{name: 'deployMetadata', importPath: '../src/tools/deployMetadata.js', args: {metadataType: 'ApexClass', metadataName: 'TestMCP'}},
	{name: 'executeAnonymousApex', importPath: '../src/tools/executeAnonymousApex.js', args: {apexCode: 'System.debug(\'Hello MCP\');'}},
	{name: 'getRecentlyViewedRecords', importPath: '../src/tools/getRecentlyViewedRecords.js'},
	{name: 'getRecord', importPath: '../src/tools/getRecord.js', args: {sObjectName: 'Account', recordId: '001KN000006KDuKYAW'}},
	{name: 'getSetupAuditTrail', importPath: '../src/tools/getSetupAuditTrail.js', args: {lastDays: 1}},
	{name: 'toolingApiRequest', importPath: '../src/tools/toolingApiRequest.js', args: {method: 'GET', endpoint: '/tooling/query/?q=SELECT+Id,+Name+FROM+ApexClass+LIMIT+1'}},
	{name: 'updateRecord', importPath: '../src/tools/updateRecord.js', args: {sObjectName: 'Account', recordId: '001KN000006KDuKYAW', fields: {Description: 'Actualitzat per test MCP'}}},
	{name: 'soqlQuery', importPath: '../src/tools/soqlQuery.js', args: {query: 'SELECT Id, Name FROM Account'}}
	*/
];

async function testTool(toolName, args = {}) {
	log('');
	log('--------------------------------');
	log(`--- Test: ${toolName} ---`);

	try {
		const result = await testToolHandler({params: {name: toolName, arguments: args}});

		if (result.isError) {
			throw new Error(result.content[0].text);
		}
		log(`✅ ${toolName} OK:`, result);

	} catch (err) {
		log(`❌ ${toolName} ERROR:`, err);
	}
}

async function main() {
	/*
    setOrgDescription({
		accessToken: '00DKN0000000yy5!AQYAQC7Y2CcH.RQPdXVJHtnuyr0GoclFfQNi48y6OP_P6Cqog4p87Umqx3uw.fLnVoniwst4T1UxOtkMiGCKdn0wPREzuhDu',
		instanceUrl: 'https://caixabankcc--devservice.sandbox.my.salesforce.com',
		username: 'u0190347@cc-caixabank.com.devservice',
		alias: 'DEVSERVICE'
	});
	*/

	//await initServer();

	for (const tool of tools) {
		await testTool(tool.name, tool.args);
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
}

log(execSync('sf config set target-org --global DEVSERVICE').toString());
main();