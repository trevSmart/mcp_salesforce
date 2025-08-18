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
import config from './config.js';
import { fileURLToPath } from 'url';
import client from './client.js';
import { getOrgAndUserDetails } from './salesforceServices.js';
import state from './state.js';
import targetOrgWatcher from './OrgWatcher.js';

// import { codeModificationPromptDefinition, codeModificationPrompt } from './prompts/codeModificationPrompt.js';
import { salesforceMcpUtilsToolDefinition } from './tools/salesforceMcpUtilsTool.js';
import { getOrgAndUserDetailsToolDefinition } from './tools/getOrgAndUserDetailsTool.js';
import { dmlOperationToolDefinition } from './tools/dmlOperationTool.js';
// import { dmlOperationToolingToolDefinition } from './tools/dmlOperationToolingTool.js';
import { deployMetadataToolDefinition } from './tools/deployMetadataTool.js';
import { describeObjectToolDefinition } from './tools/describeObjectTool.js';
// import { describeObjectUIToolDefinition } from './tools/describeObjectUITool.js'; // TODO
import { executeAnonymousApexToolDefinition } from './tools/executeAnonymousApexTool.js';
import { getRecentlyViewedRecordsToolDefinition } from './tools/getRecentlyViewedRecordsTool.js';
import { getRecordToolDefinition } from './tools/getRecordTool.js';
import { getSetupAuditTrailToolDefinition } from './tools/getSetupAuditTrailTool.js';
import { executeSoqlQueryToolDefinition } from './tools/executeSoqlQueryTool.js';
import { runApexTestToolDefinition } from './tools/runApexTestTool.js';
import { getApexClassCodeCoverageToolDefinition } from './tools/getApexClassCodeCoverageTool.js';
import { apexDebugLogsToolDefinition } from './tools/apexDebugLogsTool.js';
import { createMetadataToolDefinition } from './tools/createMetadataTool.js';
// import { chatWithAgentforceToolDefinition } from './tools/chatWithAgentforceTool.js';
// import { toolingApiRequestToolDefinition } from './tools/toolingApiRequestTool.js';
// import { triggerExecutionOrderToolDefinition } from './tools/triggerExecutionOrderTool.js';
// import { analyzeApexLogToolDefinition } from './tools/analyzeApexLogTool.js';
//import {generateSoqlQueryToolDefinition} from './tools/generateSoqlQueryTool.js';

export let resources = {};

async function setWorkspacePath(workspacePath) {
	// Normalize file:// URIs to local filesystem paths
	if (typeof workspacePath === 'string' && workspacePath.startsWith('file://')) {
		try {
			// Robust conversion for any platform
			config.workspacePath = fileURLToPath(workspacePath);

		} catch (error) { //Fallback: manual URI conversion
			config.workspacePath = decodeURIComponent(workspacePath.replace(/^file:\/\//, ''));
			process.platform === 'win32' && (config.workspacePath = config.workspacePath.replace(/^\/([a-zA-Z]):/, '$1:'));
		}
	} else {
		config.workspacePath = workspacePath;
	}

	if (config.workspacePath) {
		try {
			process.chdir(config.workspacePath);
		} catch (error) {
			log(error, 'error', 'Failed to change working directory');
		}

		log(`Workspace path set to: "${config.workspacePath}"`, 'info');
	}
}

async function updateOrgAndUserDetails() {
	try {
		const currentUsername = state.org?.user?.username;
		const org = await getOrgAndUserDetails(true);
		state.org = org;
		if (currentUsername !== org?.user?.username) {
			clearResources();
			validateUserPermissions(org.user.username);
		}

	} catch (error) {
		state.org = {};
		state.userValidated = false;
	}
}

//Create the MCP server instance
const { protocolVersion, serverInfo, capabilities, instructions } = config.SERVER_CONSTANTS;
const mcpServer = new McpServer(serverInfo, {capabilities, instructions, debouncedNotificationMethods: [
	'notifications/tools/list_changed',
	'notifications/resources/list_changed',
	'notifications/prompts/list_changed'
]});

export function newResource(uri, name, description, mimeType = 'text/plain', content, annotations = {}) {
	try {
		log(`New resource: ${uri}`, 'debug');
		annotations = { ...annotations, lastModified: new Date().toISOString() };
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
		log(error, 'error', `Error setting resource ${uri}`);
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
	// Setup exit handlers immediately to ensure cleanup even if there's an error

	mcpServer.server.setNotificationHandler(RootsListChangedNotificationSchema, async listRootsResult => {
		try {
			if (client.supportsCapability('roots')) {
				try {
					listRootsResult = await mcpServer.server.listRoots();
				} catch (error) {
					log(`Requested roots list but client returned error: ${JSON.stringify(error, null, 3)}`, 'debug');
				}
			}

			//Alguns clients fan servir el primer root per establir el directori del workspace
			if (!config.workspacePath && listRootsResult.roots?.[0]?.uri.startsWith('file://')) {
				setWorkspacePath(listRootsResult.roots[0].uri);
			}

			if (typeof resolveDirectoryChange === 'function') {
				resolveDirectoryChange();
			}

		} catch (error) {
			log(error, 'error', 'Failed to request roots from client');
		}
	});

	mcpServer.server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: Object.values(resources) }));
	mcpServer.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: [] }));
	mcpServer.server.setRequestHandler(ReadResourceRequestSchema, async ({ params: { uri } }) => ({ contents: [{ uri, ...resources[uri] }] }));

	// mcpServer.registerPrompt('code-modification', codeModificationPromptDefinition, codeModificationPrompt);

	const callToolHandler = tool => {
		return async params => {
			if (tool !== 'getOrgAndUserDetailsTool' && tool !== 'salesforceMcpUtilsTool') {
				if (!state.org.user.id) {
					const errorMessage = `❌ Org and user details not available. The server may still be initializing.`;
					log(errorMessage, 'critical');
					return {
						isError: true,
						content: [{
							type: 'text',
							text: errorMessage
						}]
					};
				} else if (!state.userValidated) {
					const errorMessage = `🚫 Request blocked due to unsuccessful user validation for "${state.org.user.username}"`;
					log(errorMessage, 'critical');
					return {
						isError: true,
						content: [{
							type: 'text',
							text: errorMessage
						}]
					};
				}
			}

			const toolModule = await import(`./tools/${tool}.js`);
			const toolFunction = toolModule[`${tool}`];
			if (!toolFunction) {
				throw new Error(`Tool function ${tool}Tool not found in module`);
			}
			return await toolFunction(params);
		};
	};

	mcpServer.registerTool('salesforceMcpUtils', salesforceMcpUtilsToolDefinition, callToolHandler('salesforceMcpUtilsTool'));
	mcpServer.registerTool('getOrgAndUserDetails', getOrgAndUserDetailsToolDefinition, callToolHandler('getOrgAndUserDetailsTool'));
	mcpServer.registerTool('dmlOperation', dmlOperationToolDefinition, callToolHandler('dmlOperationTool'));
	// mcpServer.registerTool('dmlOperationTooling', dmlOperationToolingToolDefinition, callToolHandler('dmlOperationToolingTool'));
	mcpServer.registerTool('deployMetadata', deployMetadataToolDefinition, callToolHandler('deployMetadataTool'));
	mcpServer.registerTool('describeObject', describeObjectToolDefinition, callToolHandler('describeObjectTool'));
	// mcpServer.registerTool('describeObjectUI', describeObjectUIToolDefinition, callToolHandler('describeObjectUITool')); // TODO
	mcpServer.registerTool('executeAnonymousApex', executeAnonymousApexToolDefinition, callToolHandler('executeAnonymousApexTool'));
	mcpServer.registerTool('getRecentlyViewedRecords', getRecentlyViewedRecordsToolDefinition, callToolHandler('getRecentlyViewedRecordsTool'));
	mcpServer.registerTool('getRecord', getRecordToolDefinition, callToolHandler('getRecordTool'));
	mcpServer.registerTool('getSetupAuditTrail', getSetupAuditTrailToolDefinition, callToolHandler('getSetupAuditTrailTool'));
	mcpServer.registerTool('executeSoqlQuery', executeSoqlQueryToolDefinition, callToolHandler('executeSoqlQueryTool'));
	mcpServer.registerTool('runApexTest', runApexTestToolDefinition, callToolHandler('runApexTestTool'));
	mcpServer.registerTool('apexDebugLogs', apexDebugLogsToolDefinition, callToolHandler('apexDebugLogsTool'));
	mcpServer.registerTool('getApexClassCodeCoverage', getApexClassCodeCoverageToolDefinition, callToolHandler('getApexClassCodeCoverageTool'));
	mcpServer.registerTool('createMetadata', createMetadataToolDefinition, callToolHandler('createMetadataTool'));
	// mcpServer.registerTool('chatWithAgentforce', chatWithAgentforceToolDefinition, callToolHandler('chatWithAgentforceTool'));
	// mcpServer.registerTool('toolingApiRequest', toolingApiRequestToolDefinition, callToolHandler('toolingApiRequestTool'));
	// mcpServer.registerTool('triggerExecutionOrder', triggerExecutionOrderToolDefinition, callToolHandler('triggerExecutionOrderTool'));
	// mcpServer.registerTool('analyzeApexLog', analyzeApexLogToolDefinition, callToolHandler('analyzeApexLogTool'));

	//Set up request handlers
	mcpServer.server.setRequestHandler(SetLevelRequestSchema, async ({ params }) => {
		state.currentLogLevel = params.level;
		return {};
	});

	mcpServer.server.setRequestHandler(InitializeRequestSchema, async ({ params }) => {
		try {
			const { clientInfo, capabilities: clientCapabilities, protocolVersion: clientProtocolVersion } = params;
			client.initialize({ clientInfo, capabilities: clientCapabilities, protocolVersion: clientProtocolVersion });

			log(`IBM Salesforce MCP server (v${config.SERVER_CONSTANTS.serverInfo.version})`, 'info');
			log(`Current log level: ${state.currentLogLevel}`, 'info');
			const clientCapabilitiesString = 'Capabilities: ' + JSON.stringify(client.capabilities, null, 3);
			log(`Connecting with client "${client.clientInfo.name}" (v${client.clientInfo.version}). ${clientCapabilitiesString}`, 'info');

			if (process.env.WORKSPACE_FOLDER_PATHS) {
				setWorkspacePath(process.env.WORKSPACE_FOLDER_PATHS);
			}

			if (client.supportsCapability('roots')) {
				try {
					await mcpServer.server.listRoots();
				} catch (error) {
					log(`Requested roots list but client returned error: ${JSON.stringify(error, null, 3)}`, 'debug');
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
					await updateOrgAndUserDetails();
					log(`Server initialized and running. Target org: ${state.org.alias}`, 'debug');
					targetOrgWatcher.start(updateOrgAndUserDetails);

				} catch (error) {
					log(error, 'error', 'Error during async org setup');
					throw error;

				/*
				} finally { TODO
					//Mark server as ready after org setup is complete (or failed)
					/*if (typeof resolveServerReady === 'function') {
						resolveServerReady();
					}
				*/
				}
			})();

			return { protocolVersion, serverInfo, capabilities };

		} catch (error) {
			log(error, 'error', 'Error initializing server');
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