import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');
import os from 'os';
import {exec} from 'child_process';
import {promisify} from 'util';
const execPromise = promisify(exec);

import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {
	SetLevelRequestSchema,
	InitializeRequestSchema,
	ListResourcesRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import {log, validateUserPermissions} from './utils.js';
import {CONFIG} from './config.js';
import client from './client.js';
import {getOrgAndUserDetails} from './salesforceServices.js';
import state from './state.js';

import {codeModificationPromptDefinition, codeModificationPrompt} from './prompts/codeModificationPrompt.js';
import {salesforceMcpUtilsToolDefinition, salesforceMcpUtilsTool} from './tools/salesforceMcpUtilsTool.js';
import {getOrgAndUserDetailsToolDefinition, getOrgAndUserDetailsTool} from './tools/getOrgAndUserDetailsTool.js';
import {dmlOperationToolDefinition, dmlOperationTool} from './tools/dmlOperationTool.js';
import {deployMetadataToolDefinition, deployMetadataTool} from './tools/deployMetadataTool.js';
import {describeObjectToolDefinition, describeObjectTool} from './tools/describeObjectTool.js';
import {executeAnonymousApexToolDefinition, executeAnonymousApexTool} from './tools/executeAnonymousApexTool.js';
import {getRecentlyViewedRecordsToolDefinition, getRecentlyViewedRecordsTool} from './tools/getRecentlyViewedRecordsTool.js';
import {getRecordToolDefinition, getRecordTool} from './tools/getRecordTool.js';
import {getSetupAuditTrailToolDefinition, getSetupAuditTrailTool} from './tools/getSetupAuditTrailTool.js';
import {executeSoqlQueryToolDefinition, executeSoqlQueryTool} from './tools/executeSoqlQueryTool.js';
import {runApexTestToolDefinition, runApexTestTool} from './tools/runApexTestTool.js';
import {apexDebugLogsToolDefinition, apexDebugLogsTool} from './tools/apexDebugLogsTool.js';
//import {generateSoqlQueryToolDefinition, generateSoqlQueryTool} from './tools/generateSoqlQueryTool.js';

const SERVER_CONSTANTS = {
	protocolVersion: '2025-06-18',
	serverInfo: {
		name: 'salesforce-mcp',
		version: pkg.version
	},
	capabilities: {
		logging: {},
		resources: {
			subscribe: true,
			listChanged: true
		},
		prompts: {},
		tools: {},
		completions: {},
		elicitation: {}
	},
	instructions: 'This is a Salesforce MCP server. It is used to interact with Salesforce.'
};

//Global resources storage
export const resources = {};

//Create the MCP server instance
const {protocolVersion, serverInfo, capabilities, instructions} = SERVER_CONSTANTS;
const mcpServer = new McpServer(serverInfo, {
	capabilities,
	instructions,
	debouncedNotificationMethods: [
		'notifications/tools/list_changed',
		'notifications/resources/list_changed',
		'notifications/prompts/list_changed'
	]
});

//Server initialization function
export async function setupServer() {
	//Set up resource handling
	mcpServer.server.setRequestHandler(ListResourcesRequestSchema, async () => ({resources: Object.values(resources)}));

	//Register prompts
	mcpServer.registerPrompt('code-modification', codeModificationPromptDefinition, codeModificationPrompt);

	//Register tools
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
	mcpServer.registerTool('apexDebugLogs', apexDebugLogsToolDefinition, apexDebugLogsTool);

	//Set up request handlers
	mcpServer.server.setRequestHandler(SetLevelRequestSchema, async ({params}) => {
		CONFIG.setLogLevel(params.level);
		return {};
	});

	mcpServer.server.setRequestHandler(InitializeRequestSchema, async ({params}) => {
		try {
			const {clientInfo, capabilities: clientCapabilities, protocolVersion: clientProtocolVersion} = params;
			client.initialize({clientInfo, capabilities: clientCapabilities, protocolVersion: clientProtocolVersion});

			log(`IBM Salesforce MCP server (v${SERVER_CONSTANTS.serverInfo.version})`, 'notice');
			log(`Connecting with client: "${client.clientInfo.name} (v${client.clientInfo.version})"`, 'notice');
			log(`Client capabilities: ${JSON.stringify(client.capabilities, null, '3')}`, 'debug');

			/*
			if (client.supportsCapability('sampling')) {
				mcpServer.registerTool('generateSoqlQuery', generateSoqlQueryToolDefinition, generateSoqlQueryTool);
			}
			*/

			//Execute org setup and validation asynchronously
			(async () => {
				try {
					await execPromise(`${os.platform() === 'win32' ? 'set' : 'export'} HOME=${process.env.HOME}`);
					const org = await getOrgAndUserDetails();
					state.org = org;
					log(`Server initialized and running. Target org: ${org.alias}`, 'debug');
					await validateUserPermissions(org.user.id);
				} catch (error) {
					log(`Error during async org setup: ${error.message}`, 'error');
				}
			})();

			return {protocolVersion, serverInfo, capabilities};

		} catch (error) {
			log(`Error initializing server: ${error.message}`, 'error');
			throw error;
		}
	});

	//Connect to transport
	await mcpServer.connect(new StdioServerTransport()).then(() => new Promise(r => setTimeout(r, 400)));
	CONFIG.workspacePath && log(`Working directory: "${CONFIG.workspacePath}"`, 'debug');

	return {protocolVersion, serverInfo, capabilities};
}

//Utility functions
export async function sendElicitRequest(elicitationProperties) {
	if (client.supportsCapability('elicitation')) {
		const elicitationResult = await mcpServer.server.elicitInput({
			message: elicitationProperties.description,
			requestedSchema: {
				type: 'object',
				properties: elicitationProperties,
				required: ['confirmation']
			}
		});
		return elicitationResult;
	}
}

export function newResource(uri, mimeType = 'text/plain', content, annotations = {}) {
	annotations = {...annotations, lastModified: new Date().toISOString()};
	try {
		const resource = {
			uri,
			name: uri,
			description: uri,
			mimeType,
			text: content,
			annotations
		};
		resources[uri] = resource;

		if (client.supportsCapability('resources')) {
			mcpServer.server.sendResourceListChanged();
		}
		return resource;

	} catch (error) {
		log(`Error setting resource ${uri}: ${error.message}`, 'error');
	}
}

//Export the server instance for direct access when needed
export {mcpServer};