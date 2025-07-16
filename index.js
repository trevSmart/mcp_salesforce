import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const pkg = require('./package.json');
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	InitializeRequestSchema,
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

const SERVER_INFO = {name: 'salesforce-mcp', version: pkg.version};
const SERVER_CAPABILITIES = {
	logging: {}, resources: {}, prompts: {}, tools: {}, completions: {}, elicitation: {}
};

const mcpServer = new McpServer(SERVER_INFO, {capabilities: SERVER_CAPABILITIES});
const server = mcpServer.server;
state.server = server;

//Ready promise for server connection
let resolveServerReady;
state.server.readyPromise = new Promise(resolve => {
	resolveServerReady = resolve;
});


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
	try {
		resources[uri] = content;
		if (mcpServer.isConnected()) {
			server.sendResourceListChanged();
		}
	} catch (error) {
		log(`Error setting resource ${uri}: ${error.message}`, 'error');
	}
}

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

server.setRequestHandler(InitializeRequestSchema, async ({params: {clientInfo, capabilities}}) => {
	state.client = {clientInfo, capabilities};
	log(`Establishing connection with client "${state.client.clientInfo.name} (v${state.client.clientInfo.version})"`, 'notice');
	return {protocolVersion: '2025-06-18', capabilities: SERVER_CAPABILITIES, serverInfo: SERVER_INFO};
});

//Register resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({resources: Object.values(resourceDefinitions)}));
server.setRequestHandler(ReadResourceRequestSchema, async request => {
	const uri = request?.uri || request?.params?.uri;
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

server.setNotificationHandler(RootsListChangedNotificationSchema, async () => {
	try {
		const listRootsResponse = await server.listRoots();
		if (listRootsResponse && 'roots' in listRootsResponse) {
			state.roots = listRootsResponse.roots;
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		log(`Failed to request roots from client: ${errorMessage}`, 'error');
	}
});

const transport = new StdioServerTransport();

export async function main() {
	try {
		await server.connect(transport);
		log(`IBM Salesforce MCP server (v${SERVER_INFO.version})`, 'notice');
		CONFIG.workspacePath && log(`Working directory: "${CONFIG.workspacePath}"`, 'debug');
		await initServer();

		//Resolve readyPromise when server is connected
		if (typeof resolveServerReady === 'function') {
			resolveServerReady();
		}

		server.listRoots();

	} catch (error) {
		log(`Error starting IBM MCP Salesforce server: ${error.message}`, 'error');
		await server.close();
		process.exit(1);
	}
}

main();