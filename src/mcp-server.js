
import os from 'os';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
	SetLevelRequestSchema,
	InitializeRequestSchema,
	RootsListChangedNotificationSchema,
	ListResourcesRequestSchema,
	ListResourceTemplatesRequestSchema,
	ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { log, validateUserPermissions } from './utils.js';
import { config, SERVER_CONSTANTS } from './config.js';
import client from './client.js';
import { getOrgAndUserDetails } from './salesforceServices.js';
import state from './state.js';

import { codeModificationPromptDefinition, codeModificationPrompt } from './prompts/codeModificationPrompt.js';
import { salesforceMcpUtilsToolDefinition, salesforceMcpUtilsTool } from './tools/salesforceMcpUtilsTool.js';
import { getOrgAndUserDetailsToolDefinition, getOrgAndUserDetailsTool } from './tools/getOrgAndUserDetailsTool.js';
import { dmlOperationToolDefinition, dmlOperationTool } from './tools/dmlOperationTool.js';
import { deployMetadataToolDefinition, deployMetadataTool } from './tools/deployMetadataTool.js';
import { describeObjectToolDefinition, describeObjectTool } from './tools/describeObjectTool.js';
import { executeAnonymousApexToolDefinition, executeAnonymousApexTool } from './tools/executeAnonymousApexTool.js';
import { getRecentlyViewedRecordsToolDefinition, getRecentlyViewedRecordsTool } from './tools/getRecentlyViewedRecordsTool.js';
import { getRecordToolDefinition, getRecordTool } from './tools/getRecordTool.js';
import { getSetupAuditTrailToolDefinition, getSetupAuditTrailTool } from './tools/getSetupAuditTrailTool.js';
import { executeSoqlQueryToolDefinition, executeSoqlQueryTool } from './tools/executeSoqlQueryTool.js';
import { runApexTestToolDefinition, runApexTestTool } from './tools/runApexTestTool.js';
import { apexDebugLogsToolDefinition, apexDebugLogsTool } from './tools/apexDebugLogsTool.js';
//import {generateSoqlQueryToolDefinition, generateSoqlQueryTool} from './tools/generateSoqlQueryTool.js';

export let resources = {};

//Create the MCP server instance
const { protocolVersion, serverInfo, capabilities, instructions } = SERVER_CONSTANTS;
const mcpServer = new McpServer(serverInfo, {
	capabilities,
	instructions,
	debouncedNotificationMethods: [
		'notifications/tools/list_changed',
		'notifications/resources/list_changed',
		'notifications/prompts/list_changed'
	]
});

export function newResource(uri, name, description, mimeType = 'text/plain', content, annotations = {}) {
	annotations = { ...annotations, lastModified: new Date().toISOString() };
	try {
		const resource = {
			uri,
			name,
			description,
			mimeType,
			text: content,
			annotations
		};
		resources[uri] = resource;
		mcpServer.server.sendResourceListChanged();
		return resource;

	} catch (error) {
		log(`Error setting resource ${uri}: ${error.message}`, 'error');
	}
}


export function clearResources() {
	resources = {};
	mcpServer.server.sendResourceListChanged();
}

//Ready promise mechanism for external waiting
let resolveServerReady;
const readyPromise = new Promise(resolve => resolveServerReady = resolve);

//Add a promise to track directory change completion
let resolveDirectoryChange;
const directoryChangePromise = new Promise(resolve => resolveDirectoryChange = resolve);

//Server initialization function
export async function setupServer() {

	mcpServer.server.setNotificationHandler(RootsListChangedNotificationSchema, async listRootsResult => {
		try {
			if (client.supportsCapability('roots')) {
				try {
					listRootsResult = await mcpServer.server.listRoots();
				} catch (error) {
					log(`Requested roots list but client returned error: ${error.message}`, 'debug');
				}
			}

			//Alguns clients fan servir el primer root per establir el directori del workspace
			if (!config.workspacePath
				&& listRootsResult.roots?.[0]?.uri.startsWith('file://')) {
				config.setWorkspacePath(listRootsResult.roots[0].uri);
			}
			if (config.workspacePath) {
				try {
					process.chdir(config.workspacePath);
					log(`Successfully changed directory to workspace path: ${config.workspacePath}`, 'debug');
				} catch (error) {
					log(`Failed to change working directory from ${process.cwd()} to ${config.workspacePath}: ${error.message}`, 'error');
				}
			}

			if (typeof resolveDirectoryChange === 'function') {
				resolveDirectoryChange();
			}

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			log(`Failed to request roots from client: ${errorMessage}`, 'error');
		}
	});

	mcpServer.server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: Object.values(resources) }));
	mcpServer.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ templates: [] }));
	mcpServer.server.setRequestHandler(ReadResourceRequestSchema, async ({ params: { uri } }) => ({ contents: [{ uri, ...resources[uri] }] }));
	mcpServer.registerPrompt('code-modification', codeModificationPromptDefinition, codeModificationPrompt);
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
	mcpServer.server.setRequestHandler(SetLevelRequestSchema, async ({ params }) => {
		config.setLogLevel(params.level);
		return {};
	});

	mcpServer.server.setRequestHandler(InitializeRequestSchema, async ({ params }) => {
		try {
			const { clientInfo, capabilities: clientCapabilities, protocolVersion: clientProtocolVersion } = params;
			client.initialize({ clientInfo, capabilities: clientCapabilities, protocolVersion: clientProtocolVersion });
			log(`IBM Salesforce MCP server (v${SERVER_CONSTANTS.serverInfo.version})`, 'info');
			const clientCapabilitiesString = 'Capabilities: ' + Object.keys(client.capabilities).join(', ') + '.';
			log(`Connecting with client "${client.clientInfo.name} (v${client.clientInfo.version})". ${clientCapabilitiesString}`, 'info');

			if (process.env.WORKSPACE_FOLDER_PATHS) {
				config.setWorkspacePath(process.env.WORKSPACE_FOLDER_PATHS);
			}

			if (client.supportsCapability('roots')) {
				try {
					await mcpServer.server.listRoots();
				} catch (error) {
					log(`Requested roots list but client returned error: ${error.message}`, 'debug');
				}
			}

			/*
			if (client.supportsCapability('sampling')) {
				mcpServer.registerTool('generateSoqlQuery', generateSoqlQueryToolDefinition, generateSoqlQueryTool);
			}
			*/

			//Execute org setup and validation after directory change is complete
			(async () => {
				try {
					//Wait for directory change to complete before proceeding with org setup
					await directoryChangePromise;

					process.env.HOME = process.env.HOME || os.homedir();
					const org = await getOrgAndUserDetails();
					state.org = org;

					newResource(
						'mcp://mcp/orgAndUserDetail.json',
						'Org and user details',
						'Org and user details',
						'application/json',
						JSON.stringify(org, null, 3)
					);

					log(`Server initialized and running. Target org: ${org.alias}`, 'debug');
					await validateUserPermissions(org.user.id);
					//setInterval(() => validateUserPermissions(org.user.id), 1200000);

				} catch (error) {
					log(`Error during async org setup: ${error.message}`, 'error');
				} finally {
					//Mark server as ready after org setup is complete (or failed)
					/*if (typeof resolveServerReady === 'function') {
						resolveServerReady();
					} */
				}
			})();

			return { protocolVersion, serverInfo, capabilities };

		} catch (error) {
			log(`Error initializing server: ${error.message}`, 'error');
			throw error;
		}
	});

	await mcpServer.connect(new StdioServerTransport()).then(() => new Promise(r => setTimeout(r, 400)));
	if (typeof resolveServerReady === 'function') {
		resolveServerReady();
	}
	return { protocolVersion, serverInfo, capabilities };
}

//Export the ready promise for external use
export { readyPromise };

export { mcpServer };