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

import {validateUserPermissions} from './utils.js';
import {createModuleLogger} from './lib/logger.js';
import config from './config.js';
import {fileURLToPath} from 'url';
import client from './client.js';
import {getOrgAndUserDetails} from './lib/salesforceServices.js';
import state from './state.js';
import targetOrgWatcher from './lib/OrgWatcher.js';
import {ensureBaseTmpDir} from './lib/tempManager.js';

// import { codeModificationPromptDefinition, codeModificationPrompt } from './prompts/codeModificationPrompt.js';
import {toolsBasicRunPromptDefinition, toolsBasicRunPromptHandler} from './prompts/call-all-tools.js';
import {salesforceMcpUtilsToolDefinition, salesforceMcpUtilsToolHandler} from './tools/salesforceMcpUtils.js';
import {dmlOperationToolDefinition} from './tools/dmlOperation.js';
import {deployMetadataToolDefinition, deployMetadataToolHandler} from './tools/deployMetadata.js';
import {describeObjectToolDefinition, describeObjectToolHandler} from './tools/describeObject.js';
import {executeAnonymousApexToolDefinition, executeAnonymousApexToolHandler} from './tools/executeAnonymousApex.js';
import {getRecentlyViewedRecordsToolDefinition} from './tools/getRecentlyViewedRecords.js';
import {getRecordToolDefinition, getRecordToolHandler} from './tools/getRecord.js';
import {getSetupAuditTrailToolDefinition} from './tools/getSetupAuditTrail.js';
import {executeSoqlQueryToolDefinition, executeSoqlQueryToolHandler} from './tools/executeSoqlQuery.js';
import {runApexTestToolDefinition} from './tools/runApexTest.js';
import {getApexClassCodeCoverageToolDefinition} from './tools/getApexClassCodeCoverage.js';
import {apexDebugLogsToolDefinition} from './tools/apexDebugLogs.js';
import {createMetadataToolDefinition} from './tools/createMetadata.js';
import {invokeApexRestResourceToolDefinition} from './tools/invokeApexRestResource.js';
// import { chatWithAgentforceDefinition } from './tools/chatWithAgentforce.js';
// import { triggerExecutionOrderToolDefinition } from './tools/triggerExecutionOrder.js';
//import {generateSoqlQueryToolDefinition} from './tools/generateSoqlQuery.js';

const logger = createModuleLogger(import.meta.url);
export let resources = {};

async function setWorkspacePath(workspacePath) {
	// Handle multiple workspace paths separated by commas
	let targetPath = workspacePath;
	if (typeof workspacePath === 'string' && workspacePath.includes(',')) {
		// Take the first path if multiple paths are provided
		targetPath = workspacePath.split(',')[0].trim();
	}

	// Normalize file:// URIs to local filesystem paths
	if (typeof targetPath === 'string' && targetPath.startsWith('file://')) {
		try {
			// Robust conversion for any platform
			state.workspacePath = fileURLToPath(targetPath);

		} catch { //Fallback: manual URI conversion
			state.workspacePath = decodeURIComponent(targetPath.replace(/^file:\/\//, ''));
			process.platform === 'win32' && (state.workspacePath = state.workspacePath.replace(/^\/([a-zA-Z]):/, '$1:'));
		}
	} else {
		state.workspacePath = targetPath;
	}

	logger.info(`Workspace path set to: "${state.workspacePath}"`);

	if (state.workspacePath) {
		if (state.workspacePath !== process.cwd()) {
			try {
				process.chdir(state.workspacePath);
			} catch (error) {
				logger.error(error, 'Failed to change working directory');
			}
		}

		// Ensure tmp directory exists (no scheduling; cleanup happens on writes)
		try {
			ensureBaseTmpDir(state.workspacePath);
		} catch (error) {
			logger.error(error, 'Temp directory setup failed');
		}
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
		logger.error(error, 'Error updating org and user details');
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

// Expose server instance to break import cycles in utility logging
// (utils reads via globalThis.__mcpServer instead of importing this module)
globalThis.__mcpServer = mcpServer;

export function newResource(uri, name, description, mimeType = 'text/plain', content, annotations = {}) {
	try {
		logger.debug(`MCP resource "${uri}" changed.`);
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
		logger.error(error, `Error setting resource ${uri}`);
	}
}

export function clearResources() {
	if (Object.keys(resources).length) {
		logger.debug('Clearing resources...');
		resources = {};
		mcpServer.server.sendResourceListChanged();
	}
}

// Ready promises for external waiting
let resolveServerReady;
const readyPromise = new Promise(resolve => resolveServerReady = resolve); // transport connected
let resolveOrgReady;
const orgReadyPromise = new Promise(resolve => resolveOrgReady = resolve); // org details loaded/attempted

//Server initialization function
export async function setupServer() {
	// Setup exit handlers immediately to ensure cleanup even if there's an error

	mcpServer.server.setNotificationHandler(RootsListChangedNotificationSchema, async listRootsResult => {
		try {
			if (client.supportsCapability('roots')) {
				try {
					listRootsResult = await mcpServer.server.listRoots();
				} catch (error) {
					logger.debug(`Requested roots list but client returned error: ${JSON.stringify(error, null, 3)}`);
				}
			}

			//Some clients use the first root to establish the workspace directory
			if (!state.workspacePath && listRootsResult.roots?.[0]?.uri.startsWith('file://')) {
				setWorkspacePath(listRootsResult.roots[0].uri);
			}


		} catch (error) {
			logger.error(error, 'Failed to request roots from client');
		}
	});

	mcpServer.server.setRequestHandler(ListResourcesRequestSchema, async() => ({resources: Object.values(resources)}));
	mcpServer.server.setRequestHandler(ListResourceTemplatesRequestSchema, async() => ({resourceTemplates: []}));
	mcpServer.server.setRequestHandler(ReadResourceRequestSchema, async({params: {uri}}) => ({contents: [{uri, ...resources[uri]}]}));

	// mcpServer.registerPrompt('code-modification', codeModificationPromptDefinition, codeModificationPrompt);
	mcpServer.registerPrompt('tools-basic-run', toolsBasicRunPromptDefinition, toolsBasicRunPromptHandler);

	// Handlers that we want to load statically (frequently used/core)
	const STATIC_TOOL_HANDLERS = {
		salesforceMcpUtils: salesforceMcpUtilsToolHandler,
		executeSoqlQuery: executeSoqlQueryToolHandler,
		describeObject: describeObjectToolHandler,
		getRecord: getRecordToolHandler,
		executeAnonymousApex: executeAnonymousApexToolHandler,
		deployMetadata: deployMetadataToolHandler
	};

	const callToolHandler = tool => {
		// Accept both parsed args and MCP extra context (progress, sendNotification, etc.)
		return async(params, args) => {
			try {
				if (tool !== 'salesforceMcpUtils') {
					if (!state.org.user.id) {
						throw new Error('❌ Org and user details not available. The server may still be initializing.');
					} else if (!state.userValidated) {
						throw new Error(`🚫 Request blocked due to unsuccessful user validation for "${state.org.user.username}".`);
					}
				}
				// Prefer statically loaded handlers for core tools; fallback to lazy dynamic import
				let toolHandler = STATIC_TOOL_HANDLERS[tool];
				if (!toolHandler) {
					const toolModule = await import(`./tools/${tool}.js`);
					toolHandler = toolModule?.[`${tool}ToolHandler`];
				}
				if (!toolHandler) {
					throw new Error(`Tool ${tool} module does not export a tool handler.`);
				}
				return await toolHandler(params, args);
			} catch (error) {
				logger.error(error.message, `Error calling tool ${tool}`);
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
	mcpServer.registerTool('invokeApexRestResource', invokeApexRestResourceToolDefinition, callToolHandler('invokeApexRestResource'));
	// mcpServer.registerTool('chatWithAgentforce', chatWithAgentforceDefinition, callToolHandler('chatWithAgentforce'));
	// mcpServer.registerTool('triggerExecutionOrder', triggerExecutionOrderDefinition, callToolHandler('triggerExecutionOrder'));
	// mcpServer.registerTool('generateSoqlQuery', generateSoqlQueryDefinition, callToolHandler('generateSoqlQuery'));

	mcpServer.server.setRequestHandler(SetLevelRequestSchema, async({params}) => {
		state.currentLogLevel = params.level;
		return {};
	});

	mcpServer.server.setRequestHandler(InitializeRequestSchema, async({params}) => {
		try {
			const {clientInfo, capabilities: clientCapabilities, protocolVersion: clientProtocolVersion} = params;
			client.initialize({clientInfo, capabilities: clientCapabilities, protocolVersion: clientProtocolVersion});

			logger.info(`IBM Salesforce MCP server (v${config.SERVER_CONSTANTS.serverInfo.version})`);
			const clientCapabilitiesString = 'Capabilities: ' + JSON.stringify(client.capabilities, null, 3);
			logger.info(`Connecting with client "${client.clientInfo.name}" (v${client.clientInfo.version}). ${clientCapabilitiesString}`);
			logger.info(`Current log level: ${state.currentLogLevel}`);

			if (process.env.WORKSPACE_FOLDER_PATHS) {
				setWorkspacePath(process.env.WORKSPACE_FOLDER_PATHS);
			} else if (client.supportsCapability('roots')) {
				await mcpServer.server.listRoots();
			}

			//if (client.supportsCapability('sampling')) {
			//	mcpServer.registerTool('generateSoqlQuery', generateSoqlQueryDefinition, generateSoqlQuery);
			//}

			//Execute org setup and validation after directory change is complete
			(async() => {
				try {
					// Start watching target org changes and perform initial fetch
					// process.env.HOME = process.env.HOME ;
					targetOrgWatcher.start(updateOrgAndUserDetails);
					await updateOrgAndUserDetails();

					logger.debug(`Server initialized and running. Target org: ${state.org.alias}`, 'init');
					if (typeof resolveOrgReady === 'function') {
						resolveOrgReady();
					}

				} catch (error) {
					logger.error(error, 'Error during async org setup');
					// Swallow to avoid unhandled rejection; initialization continues and tools will gate on validation
					if (typeof resolveOrgReady === 'function') {
						resolveOrgReady();
					}

				}
			})();

			return {protocolVersion, serverInfo, capabilities};

		} catch (error) {
			logger.error(error, 'Error initializing server');
			// Return a structured error via JSON-RPC by throwing a concise Error
			throw new Error(`Initialization failed: ${error.message}`);
		}
	});

	await mcpServer.connect(new StdioServerTransport()).then(() => new Promise(r => setTimeout(r, 400)));
	if (typeof resolveServerReady === 'function') {
		resolveServerReady();
	}

	return {protocolVersion, serverInfo, capabilities};
}

export function sendProgressNotification(progressToken,	progress, total, message) {
	mcpServer.server.notification({method: 'notifications/progress', params: {progressToken, progress, total, message}});
}

//Export the ready promise for external use
export {readyPromise};
export {orgReadyPromise};

export {mcpServer};
