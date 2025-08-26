import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {
	SetLevelRequestSchema,
	InitializeRequestSchema,
	RootsListChangedNotificationSchema,
	ListResourcesRequestSchema,
	ListResourceTemplatesRequestSchema,
	ReadResourceRequestSchema

} from '@modelcontextprotocol/sdk/types.js';

import {log, validateUserPermissions} from './utils.js';
import config from './config.js';
import {fileURLToPath} from 'url';
import client from './client.js';
import {getOrgAndUserDetails} from './salesforceServices.js';
import state from './state.js';
import targetOrgWatcher from './OrgWatcher.js';

// import { codeModificationPromptDefinition, codeModificationPrompt } from './prompts/codeModificationPrompt.js';
import {testToolsPromptDefinition, testToolsPrompt} from './prompts/test-tools.js';
import {salesforceMcpUtilsToolDefinition} from './tools/salesforceMcpUtils.js';
import {dmlOperationToolDefinition} from './tools/dmlOperation.js';
import {deployMetadataToolDefinition} from './tools/deployMetadata.js';
import {describeObjectToolDefinition} from './tools/describeObject.js';
import {executeAnonymousApexToolDefinition} from './tools/executeAnonymousApex.js';
import {getRecentlyViewedRecordsToolDefinition} from './tools/getRecentlyViewedRecords.js';
import {getRecordToolDefinition} from './tools/getRecord.js';
import {getSetupAuditTrailToolDefinition} from './tools/getSetupAuditTrail.js';
import {executeSoqlQueryToolDefinition} from './tools/executeSoqlQuery.js';
import {runApexTestToolDefinition} from './tools/runApexTest.js';
import {getApexClassCodeCoverageToolDefinition} from './tools/getApexClassCodeCoverage.js';
import {apexDebugLogsToolDefinition} from './tools/apexDebugLogs.js';
import {createMetadataToolDefinition} from './tools/createMetadata.js';
// import { chatWithAgentforceDefinition } from './tools/chatWithAgentforce.js';
// import { triggerExecutionOrderToolDefinition } from './tools/triggerExecutionOrder.js';
//import {generateSoqlQueryToolDefinition} from './tools/generateSoqlQuery.js';

export let resources = {};

async function setWorkspacePath(workspacePath) {
	// Normalize file:// URIs to local filesystem paths
	if (typeof workspacePath === 'string' && workspacePath.startsWith('file://')) {
		try {
			// Robust conversion for any platform
			state.workspacePath = fileURLToPath(workspacePath);

		} catch { //Fallback: manual URI conversion
			state.workspacePath = decodeURIComponent(workspacePath.replace(/^file:\/\//, ''));
			process.platform === 'win32' && (state.workspacePath = state.workspacePath.replace(/^\/([a-zA-Z]):/, '$1:'));
		}
	} else {
		state.workspacePath = workspacePath;
	}

	if (state.workspacePath) {
		try {
			process.chdir(state.workspacePath);
		} catch (error) {
			log(error, 'error', 'Failed to change working directory');
		}

		log(`Workspace path set to: "${state.workspacePath}"`, 'info');
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
		log(error, 'error', 'Error updating org and user details');
		state.org = {};
		state.userValidated = false;

	}
}

//Create the MCP server instance
const {protocolVersion, serverInfo, capabilities, instructions} = config.SERVER_CONSTANTS;
const mcpServer = new McpServer(serverInfo, {capabilities, instructions, debouncedNotificationMethods: [
	'notifications/tools/list_changed',
	'notifications/resources/list_changed',
	'notifications/prompts/list_changed'
]});

export function newResource(uri, name, description, mimeType = 'text/plain', content, annotations = {}) {
	try {
		log(`MCP resource "${uri}" changed.`, 'debug');
		annotations = {...annotations, lastModified: new Date().toISOString()};
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
	if (Object.keys(resources).length) {
		log('Clearing resources...', 'debug');
		resources = {};
		mcpServer.server.sendResourceListChanged();
	}
}

//Ready promise mechanism for external waiting
let resolveServerReady;
const readyPromise = new Promise(resolve => resolveServerReady = resolve);

//Add a promise to track directory change completion
let resolveDirectoryChange;
// eslint-disable-next-line no-unused-vars
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

			//Some clients use the first root to establish the workspace directory
			if (!state.workspacePath && listRootsResult.roots?.[0]?.uri.startsWith('file://')) {
				setWorkspacePath(listRootsResult.roots[0].uri);
			}

			if (typeof resolveDirectoryChange === 'function') {
				resolveDirectoryChange();
			}

		} catch (error) {
			log(error, 'error', 'Failed to request roots from client');
		}
	});

	mcpServer.server.setRequestHandler(ListResourcesRequestSchema, async () => ({resources: Object.values(resources)}));
	mcpServer.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({resourceTemplates: []}));
	mcpServer.server.setRequestHandler(ReadResourceRequestSchema, async ({params: {uri}}) => ({contents: [{uri, ...resources[uri]}]}));

	// mcpServer.registerPrompt('code-modification', codeModificationPromptDefinition, codeModificationPrompt);
	mcpServer.registerPrompt('test-tools', testToolsPromptDefinition, testToolsPrompt);

	const callToolHandler = tool => {
		return async params => {
			try {
				if (tool !== 'salesforceMcpUtils') {
					if (!state.org.user.id) {
						throw new Error('❌ Org and user details not available. The server may still be initializing.');
					} else if (!state.userValidated) {
						throw new Error(`🚫 Request blocked due to unsuccessful user validation for "${state.org.user.username}".`);
					}
				}
				const toolModule = await import(`./tools/${tool}.js`);
				const toolHandler = toolModule?.[`${tool}ToolHandler`];
				if (!toolHandler) {
					throw new Error(`Tool ${tool} module does not export a tool handler.`);
				}
				return await toolHandler(params);
			} catch (error) {
				log(error.message, 'critical', `Error calling tool ${tool}`);
				return {isError: true, content: [{type: 'text', text: error.message}]};
			}
		};
	};

	mcpServer.registerTool('salesforceMcpUtils', salesforceMcpUtilsToolDefinition, callToolHandler('salesforceMcpUtils'));
	mcpServer.registerTool('dmlOperation', dmlOperationToolDefinition, callToolHandler('dmlOperation'));
	mcpServer.registerTool('deployMetadata', deployMetadataToolDefinition, callToolHandler('deployMetadata'));
	mcpServer.registerTool('describeObject', describeObjectToolDefinition, callToolHandler('describeObject'));
	mcpServer.registerTool('executeAnonymousApex', executeAnonymousApexToolDefinition, callToolHandler('executeAnonymousApex'));
	mcpServer.registerTool('getRecentlyViewedRecords', getRecentlyViewedRecordsToolDefinition, callToolHandler('getRecentlyViewedRecords'));
	mcpServer.registerTool('getRecord', getRecordToolDefinition, callToolHandler('getRecord'));
	mcpServer.registerTool('getSetupAuditTrail', getSetupAuditTrailToolDefinition, callToolHandler('getSetupAuditTrail'));
	mcpServer.registerTool('executeSoqlQuery', executeSoqlQueryToolDefinition, callToolHandler('executeSoqlQuery'));
	mcpServer.registerTool('runApexTest', runApexTestToolDefinition, callToolHandler('runApexTest'));
	mcpServer.registerTool('apexDebugLogs', apexDebugLogsToolDefinition, callToolHandler('apexDebugLogs'));
	mcpServer.registerTool('getApexClassCodeCoverage', getApexClassCodeCoverageToolDefinition, callToolHandler('getApexClassCodeCoverage'));
	mcpServer.registerTool('createMetadata', createMetadataToolDefinition, callToolHandler('createMetadata'));
	// mcpServer.registerTool('chatWithAgentforce', chatWithAgentforceDefinition, callToolHandler('chatWithAgentforce'));
	// mcpServer.registerTool('triggerExecutionOrder', triggerExecutionOrderDefinition, callToolHandler('triggerExecutionOrder'));
	// mcpServer.registerTool('generateSoqlQuery', generateSoqlQueryDefinition, callToolHandler('generateSoqlQuery'));

	mcpServer.server.setRequestHandler(SetLevelRequestSchema, async ({params}) => {
		state.currentLogLevel = params.level;
		log(`Log level set to ${params.level}`, 'debug');
		return {};
	});

	mcpServer.server.setRequestHandler(InitializeRequestSchema, async ({params}) => {
		try {
			const {clientInfo, capabilities: clientCapabilities, protocolVersion: clientProtocolVersion} = params;
			client.initialize({clientInfo, capabilities: clientCapabilities, protocolVersion: clientProtocolVersion});

			log(`IBM Salesforce MCP server (v${config.SERVER_CONSTANTS.serverInfo.version})`, 'info');
			const clientCapabilitiesString = 'Capabilities: ' + JSON.stringify(client.capabilities, null, 3);
			log(`Connecting with client "${client.clientInfo.name}" (v${client.clientInfo.version}). ${clientCapabilitiesString}`, 'info');
			log(`Current log level: ${state.currentLogLevel}`, 'info');

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

			//if (client.supportsCapability('sampling')) {
			//	mcpServer.registerTool('generateSoqlQuery', generateSoqlQueryDefinition, generateSoqlQuery);
			//}

			//Execute org setup and validation after directory change is complete
			(async () => {
				try {
					// Wait for directory change to complete before proceeding with org setup
					// await directoryChangePromise;

					// process.env.HOME = process.env.HOME ;
					targetOrgWatcher.start(updateOrgAndUserDetails);
					await updateOrgAndUserDetails();

					log(`Server initialized and running. Target org: ${state.org.alias}`, 'debug');

				} catch (error) {
					log(error, 'error', 'Error during async org setup');
					throw error;

					// } finally { TODO
					// 	//Mark server as ready after org setup is complete (or failed)
					// 	/*if (typeof resolveServerReady === 'function') {
					// 		resolveServerReady();
					// 	}
				}
			})();

			return {protocolVersion, serverInfo, capabilities};

		} catch (error) {
			log(error, 'error', 'Error initializing server');
			throw error;
		}
	});

	await mcpServer.connect(new StdioServerTransport()).then(() => new Promise(r => setTimeout(r, 400)));
	if (typeof resolveServerReady === 'function') {
		resolveServerReady();
	}

	return {protocolVersion, serverInfo, capabilities};
}

//Export the ready promise for external use
export {readyPromise};

export {mcpServer};