import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const pkg = require('./package.json');
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	InitializeRequestSchema, SetLevelRequestSchema,
	ListResourcesRequestSchema,	ReadResourceRequestSchema,
	ListToolsRequestSchema,	CallToolRequestSchema,
	RootsListChangedNotificationSchema
} from '@modelcontextprotocol/sdk/types.js';
import {CONFIG} from './src/config.js';
import {initServer, log} from './src/utils.js';
import state from './src/state.js';

/*Import de definicions de prompts i tools*/
/*eslint-disable no-unused-vars */
import {codeModificationPromptDefinition, codeModificationPrompt} from './src/prompts/codeModificationPrompt.js';
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
import {metadataApiRequestToolDefinition, metadataApiRequestTool} from './src/tools/metadataApiRequestTool.js';
import {apexDebugLogsToolDefinition, apexDebugLogsTool} from './src/tools/apexDebugLogs.js';

const SERVER_INFO = {name: 'salesforce-mcp', version: pkg.version};
const SERVER_CAPABILITIES = {
	logging: {}, resources: {listChanged: true}, prompts: {}, tools: {}, completions: {}, elicitation: {}
};

const mcpServer = new McpServer(SERVER_INFO, {capabilities: SERVER_CAPABILITIES});
state.mcpServer = mcpServer;

let resolveServerReady;
const server = mcpServer.server;
server.readyPromise = new Promise(resolve => resolveServerReady = resolve);
state.server = server;

const resourceDefinitions = {
	'mcp://org/org-and-user-details.json': {
		uri: 'mcp://org/org-and-user-details.json',
		name: 'Org and user details',
		title: 'Org and user details',
		description: 'Salesforce org and user details (org id, org alias, user id, username, and user full name)',
		mimeType: 'application/json'
	}
};

//Register prompts
mcpServer.registerPrompt('code-modification', codeModificationPromptDefinition, codeModificationPrompt);

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

server.setRequestHandler(InitializeRequestSchema, async ({params}) => {
	try {
		const {clientInfo, capabilities, protocolVersion} = params;
		state.client = {clientInfo, capabilities, protocolVersion};
		state.client.clientInfo.isVscode = state.client.clientInfo.name?.toLowerCase().includes('visual studio code');

		log(`IBM Salesforce MCP server (v${SERVER_INFO.version})`, 'notice');
		log(`Connecting with client: "${state.client.clientInfo.name} (v${state.client.clientInfo.version})"`, 'notice');
		log(`Client capabilities: ${JSON.stringify(state.client.capabilities, null, '\t')}`, 'debug');
	} catch (error) {
		log(`Error initializing server: ${error.message}`, 'error');
	}

	return {protocolVersion: '2025-06-18', capabilities: SERVER_CAPABILITIES, serverInfo: SERVER_INFO};
});

server.setRequestHandler(SetLevelRequestSchema, async ({params}) => {
	CONFIG.setLogLevel(params.level);
	return {};
});

//Register resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({resources: Object.values(state.resources)}));
server.setRequestHandler(ReadResourceRequestSchema, async request => {
	const uri = request?.uri || request?.params?.uri;
	const resource = state.resources[uri];
	return {contents: [resource]};
});

const toolNames = [
	'apexDebugLogs', 'salesforceMcpUtils', 'getOrgAndUserDetails', 'dmlOperation', 'deployMetadata',
	'describeObject', 'executeAnonymousApex', 'getRecentlyViewedRecords', 'getRecord',
	'getSetupAuditTrail', 'executeSoqlQuery', 'runApexTest'
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({tools: toolNames.map(name => eval(name + 'ToolDefinition'))}));

export const callToolRequestHandler = async request => {
	const {name, arguments: args, _meta = {}} = request.params;
	try {
		const toolImplementation = eval(name + 'Tool');
		return await toolImplementation(args, _meta);

	} catch (error) {
		return {
			isError: true,
			content: [{type: 'text', text: `❌ Error executing ${name}: ${error.message}`}]
		};
	}
};

server.setRequestHandler(CallToolRequestSchema, callToolRequestHandler);

const listRootsResultHandler = async listRootsResult => {
	try {
		if (listRootsResult && 'roots' in listRootsResult) {
			//Si la variable d'entorn estava buida, actualitzem la ruta del workspace
			if (!process.env.WORKSPACE_FOLDER_PATHS && listRootsResult.roots.length) {
				CONFIG.setWorkspacePath(listRootsResult.roots[0].uri);
				log(`Workspace path set from roots: "${CONFIG.workspacePath}"`, 'debug');
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		log(`Failed to request roots from client: ${errorMessage}`, 'error');
	}
};

server.setNotificationHandler(RootsListChangedNotificationSchema, async () => listRootsResultHandler(await server.listRoots()));

const transport = new StdioServerTransport();

export async function main() {
	try {
		await server.connect(transport);

		await new Promise(resolve => setTimeout(resolve, 400));
		CONFIG.workspacePath && log(`Working directory: "${CONFIG.workspacePath}"`, 'debug');
		await initServer();

		//Resolve readyPromise when server is connected
		if (typeof resolveServerReady === 'function') {
			resolveServerReady();
		}

		listRootsResultHandler(await server.listRoots());

	} catch (error) {
		log(`Error starting IBM MCP Salesforce server: ${error.message}`, 'error');
		await server.close();
		process.exit(1);
	}
}
main();