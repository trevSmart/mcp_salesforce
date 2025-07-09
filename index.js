import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const pkg = require('./package.json');
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListResourcesRequestSchema, ReadResourceRequestSchema, ListToolsRequestSchema, CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {CONFIG} from './src/config.js';
import {initServer, log} from './src/utils.js';
import state from './src/state.js';

//Prompts
import {codeModificationPromptDefinition, codeModificationPrompt} from './src/prompts/codeModificationPrompt.js';

//Tools
import {salesforceMcpUtilsToolDefinition, salesforceMcpUtilsTool} from './src/tools/salesforceMcpUtilsTool.js';
import {getOrgAndUserDetailsToolDefinition, getOrgAndUserDetailsTool} from './src/tools/getOrgAndUserDetailsTool.js';
import {dmlOperationToolDefinition, dmlOperationTool} from './src/tools/dmlOperationTool.js';
import {deployMetadataToolDefinition, deployMetadataTool} from './src/tools/deployMetadataTool.js';
import {describeObjectToolDefinition, describeObjectTool} from './src/tools/describeObjectTool.js';
import {executeAnonymousApexToolDefinition, executeAnonymousApexTool} from './src/tools/executeAnonymousApexTool.js';
import {getRecentlyViewedRecordsToolDefinition, getRecentlyViewedRecordsTool} from './src/tools/getRecentlyViewedRecordsTool.js';
import {getRecordToolDefinition, getRecordTool} from './src/tools/getRecordTool.js';
import {getSetupAuditTrailToolDefinition, getSetupAuditTrailTool} from './src/tools/getSetupAuditTrailTool.js';
import {executeSoqlQueryToolDefinition, executeSoqlQueryTool} from './src/tools/executeSoqlQueryTool.js';
import {runApexTestToolDefinition, runApexTestTool} from './src/tools/runApexTestTool.js';

const resourceDefinitions = {
	'mcp://org/org-and-user-details.json': {
		uri: 'mcp://org/org-and-user-details.json',
		name: 'Org and user details',
		title: 'Org and user details',
		description: 'Salesforce org and user details (org id, org alias, user id, username, and user full name)',
		mimeType: 'application/json'
	}
};

const resources = {
	'mcp://org/org-and-user-details.json': null
};

export function setResource(uri, content) {
	resources[uri] = content;
}
//Definir la versió del servidor en una constant
const SERVER_VERSION = pkg.version;

const mcpServer = new McpServer({name: 'salesforce-mcp', version: SERVER_VERSION}, {
	capabilities: {roots: {}, logging: {}, resources: {}, prompts: {}, tools: {}, completions: {}}
});
const server = mcpServer.server;
state.server = server;

//Register prompts
//mcpServer.registerPrompt('code-modification', codeModificationPromptDefinition, codeModificationPrompt);

/*
//Register all tools using the high-level McpServer API
mcpServer.registerTool('salesforceMcpUtils', salesforceMcpUtilsToolDefinition, salesforceMcpUtilsTool);
mcpServer.registerTool('getOrgAndUserDetails', getOrgAndUserDetailsToolDefinition, getOrgAndUserDetailsTool);
mcpServer.registerTool('dmlOperation', dmlOperationToolDefinition, dmlOperationTool);
mcpServer.registerTool('deployMetadata', deployMetadataToolDefinition, deployMetadataTool);
mcpServer.registerTool('describeObject', describeObjectToolDefinition, describeObjectTool);
mcpServer.registerTool('executeAnonymousApex', executeAnonymousApexToolDefinition, executeAnonymousApexTool);
mcpServer.registerTool('getRecentlyViewedRecords', getRecentlyViewedRecordsToolDefinition, getRecentlyViewedRecordsTool);
mcpServer.registerTool('getRecord', getRecordToolDefinition, getRecordTool);
mcpServer.registerTool('getSetupAuditTrail', getSetupAuditTrailToolDefinition, getSetupAuditTrailTool);
mcpServer.registerTool('executeSoqlQuery', executeSoqlQueryToolDefinition, executeSoqlQueryTool);
mcpServer.registerTool('runApexTest', runApexTestToolDefinition, runApexTestTool);
*/

//Register resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({resources: Object.values(resourceDefinitions)}));
server.setRequestHandler(ReadResourceRequestSchema, async request => {
	console.error('Reading resource request object:', JSON.stringify(request));
	//Intento obtener la uri de distintas formas
	const uri = request?.uri || request?.params?.uri;
	console.error(`Reading resource: "${uri}"`);
	return {
		contents: [{
			...resourceDefinitions[uri],
			text: JSON.stringify(resources[uri] ?? null)
		}]
	};
});

const toolNames = [
	'salesforceMcpUtils', 'getOrgAndUserDetails', 'dmlOperation', 'deployMetadata',
	'describeObject', 'executeAnonymousApex', 'getRecentlyViewedRecords', 'getRecord',
	'getSetupAuditTrail', 'executeSoqlQuery', 'runApexTest'
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({tools: toolNames.map(name => eval(name + 'ToolDefinition'))}));

export const callToolRequestSchemaHandler = async request => {
	const {name, arguments: args, _meta = {}} = request.params;
	try {
		if (!mcpServer.isConnected) {
			throw new Error('The MCP server is not running');
		}
		const toolImplementation = eval(name + 'Tool');
		return await toolImplementation(args, _meta);

	} catch (error) {
		return {
			isError: true,
			content: [{type: 'text', text: `❌ Error executing ${name}: ${error.message}`}]
		};
	}
};

server.setRequestHandler(CallToolRequestSchema, callToolRequestSchemaHandler);

const transport = new StdioServerTransport();

export async function main() {
	try {
		log(`IBM Salesforce MCP server (v${SERVER_VERSION})`, 'debug');
		CONFIG.workspacePath && log(`Working directory: "${CONFIG.workspacePath}"`, 'debug');
		log('Initializing server...', 'debug');
		const ok = await initServer();
		if (!ok) {
			log(`❌ User ${state.orgDescription.user.username} does not have the required permissions. Closing connection...`, 'error');
			await server.close();
			process.exit(1);
		}
		await server.connect(transport);
		log('Server initialized and running', 'debug');

		//sendListRootsRequest();
	} catch (error) {
		log(`Error starting IBM MCP Salesforce server: ${error.message}`, 'error');
		process.exit(1);
	}
}

//Only run main if this file is executed directly, not when imported
//if (import.meta.url === `file://${process.argv[1]}`) {
//await main();
main();
//}