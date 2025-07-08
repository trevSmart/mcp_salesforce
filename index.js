import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const pkg = require('./package.json');
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	ListToolsRequestSchema,
	CallToolRequestSchema,
	ElicitResultSchema
	//ListResourcesRequestSchema,
	//ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import {CONFIG} from './src/config.js';
import {initServer, log} from './src/utils.js';
import state from './src/state.js';

//Tools
import {salesforceMcpUtilsTool, salesforceMcpUtilsToolDefinition} from './src/tools/salesforceMcpUtilsTool.js';
import {getOrgAndUserDetailsTool, getOrgAndUserDetailsToolDefinition} from './src/tools/getOrgAndUserDetailsTool.js';
import {dmlOperationTool, dmlOperationToolDefinition} from './src/tools/dmlOperationTool.js';
import {deployMetadataTool, deployMetadataToolDefinition} from './src/tools/deployMetadataTool.js';
import {describeObjectTool, describeObjectToolDefinition} from './src/tools/describeObjectTool.js';
import {executeAnonymousApexTool, executeAnonymousApexToolDefinition} from './src/tools/executeAnonymousApexTool.js';
import {getRecentlyViewedRecordsTool, getRecentlyViewedRecordsToolDefinition} from './src/tools/getRecentlyViewedRecordsTool.js';
import {getRecordTool, getRecordToolDefinition} from './src/tools/getRecordTool.js';
import {getSetupAuditTrailTool, getSetupAuditTrailToolDefinition} from './src/tools/getSetupAuditTrailTool.js';
//import {apexDebugLogsTool, apexDebugLogsToolDefinition} from './src/tools/apexDebugLogs.js';
import {executeSoqlQueryTool, executeSoqlQueryToolDefinition} from './src/tools/executeSoqlQueryTool.js';
//import {toolingApiRequestTool, toolingApiRequestToolDefinition} from './src/tools/toolingApiRequest.js';
//import {triggerExecutionOrderTool, triggerExecutionOrderToolDefinition} from './src/tools/triggerExecutionOrder.js';
//import {metadataApiRequestTool, metadataApiRequestToolDefinition} from './src/tools/metadataApiRequest.js';
//import {chatWithAgentforceTool, chatWithAgentforceToolDefinition} from './src/tools/chatWithAgentforce.js';
//import {generateSoqlQueryTool, generateSoqlQueryToolDefinition} from './src/tools/generateSoqlQueryTool.js';
import {runApexTestTool, runApexTestToolDefinition} from './src/tools/runApexTestTool.js';

const toolImplementations = {
	salesforceMcpUtils: salesforceMcpUtilsTool,
	getOrgAndUserDetails: getOrgAndUserDetailsTool,
	dmlOperation: dmlOperationTool,
	deployMetadata: deployMetadataTool,
	describeObject: describeObjectTool,
	executeAnonymousApex: executeAnonymousApexTool,
	getRecentlyViewedRecords: getRecentlyViewedRecordsTool,
	getRecord: getRecordTool,
	getSetupAuditTrail: getSetupAuditTrailTool,
	//apexDebugLogs: apexDebugLogs,
	executeSoqlQuery: executeSoqlQueryTool,
	//toolingApiRequest: toolingApiRequest,
	//triggerExecutionOrder: triggerExecutionOrder,
	//metadataApiRequest: metadataApiRequest,
	//chatWithAgentforce: chatWithAgentforce,
	//generateSoqlQuery: generateSoqlQuery,
	runApexTest: runApexTestTool
};

//Definitions of tools
const toolDefinitions = [
	salesforceMcpUtilsToolDefinition,
	getOrgAndUserDetailsToolDefinition,
	dmlOperationToolDefinition,
	deployMetadataToolDefinition,
	describeObjectToolDefinition,
	executeAnonymousApexToolDefinition,
	getRecentlyViewedRecordsToolDefinition,
	getRecordToolDefinition,
	getSetupAuditTrailToolDefinition,
	//apexDebugLogsToolDefinition,
	executeSoqlQueryToolDefinition,
	//toolingApiRequestToolDefinition,
	//triggerExecutionOrderToolDefinition,
	//metadataApiRequestToolDefinition,
	//chatWithAgentforceToolDefinition,
	//generateSoqlQueryToolDefinition,
	runApexTestToolDefinition
];

//Definir la versió del servidor en una constant
const SERVER_VERSION = pkg.version;

const server = new Server({name: 'salesforce-mcp', version: SERVER_VERSION}, {
	capabilities: {
		logging: {},
		//resources: {},
		//prompts: {},
		tools: Object.fromEntries(toolDefinitions.map(def => [def.name, def])),
		elicitation: {}
	}
});

state.server = server;

server.setRequestHandler(ListToolsRequestSchema, async () => ({tools: toolDefinitions}));

export async function callToolRequestSchemaHandler(request) {
	const {name, arguments: args, _meta = {}} = request.params;

	const progressToken = _meta.progressToken;

	try {
		log(`Executing tool: "${name}" with args: ${JSON.stringify(args, null, 3)}`);
		return await toolImplementations[name](args, _meta);

	} catch (error) {
		log(`Error executing ${name}:`, 'error');
		if (progressToken) {
			server.notification('notifications/progress', {
				progressToken,
				progress: 100,
				total: 100,
				message: `Tool execution failed: ${error.message}`
			});
		}
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error executing ${name}: ${error.message}`
			}]
		};
	}
}

server.setRequestHandler(CallToolRequestSchema, callToolRequestSchemaHandler);

const transport = new StdioServerTransport();

async function main() {
	try {
		log(`IBM Salesforce MCP server (v${SERVER_VERSION})`, 'debug');
		log(`Working directory: "${CONFIG.workspacePath}"`, 'debug');
		log('Initializing server...', 'debug');
		const ok = await initServer();
		if (!ok) {
			log(`❌ User ${state.orgDescription.user.username} does not have the required permissions. Closing connection...`, 'error');
			await server.close();
			process.exit(1);
		}
		await server.connect(transport);
		log('Server initialized and running', 'debug');

	} catch (error) {
		log(`Error starting IBM MCP Salesforce server: ${error.message}`, 'error');
		process.exit(1);
	}
}

await main();