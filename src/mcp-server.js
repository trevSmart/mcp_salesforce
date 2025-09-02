import {fileURLToPath} from 'node:url';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	InitializeRequestSchema,
	ListResourcesRequestSchema,
	ListResourceTemplatesRequestSchema,
	ReadResourceRequestSchema,
	RootsListChangedNotificationSchema
} from '@modelcontextprotocol/sdk/types.js';

import client from './client.js';
import config from './config.js';
import {createModuleLogger} from './lib/logger.js';
import targetOrgWatcher from './lib/OrgWatcher.js';
import { getOrgAndUserDetails } from './lib/salesforceServices.js';

//Prompts
//import { codeModificationPromptDefinition, codeModificationPrompt } from './prompts/codeModificationPrompt.js';
import {apexRunScriptPromptDefinition, apexRunScriptPrompt} from './prompts/apex-run-script.js';
import { toolsBasicRunPromptDefinition, toolsBasicRunPromptHandler } from './prompts/call-all-tools.js';

//Tools
import {apexDebugLogsToolDefinition} from './tools/apexDebugLogs.js';
import {createMetadataToolDefinition} from './tools/createMetadata.js';
import {deployMetadataToolDefinition, deployMetadataToolHandler} from './tools/deployMetadata.js';
import {describeObjectToolDefinition, describeObjectToolHandler} from './tools/describeObject.js';
import {dmlOperationToolDefinition} from './tools/dmlOperation.js';
import {executeAnonymousApexToolDefinition, executeAnonymousApexToolHandler} from './tools/executeAnonymousApex.js';
import {executeSoqlQueryToolDefinition, executeSoqlQueryToolHandler} from './tools/executeSoqlQuery.js';
import {getApexClassCodeCoverageToolDefinition} from './tools/getApexClassCodeCoverage.js';
import {getRecentlyViewedRecordsToolDefinition} from './tools/getRecentlyViewedRecords.js';
import {getRecordToolDefinition, getRecordToolHandler} from './tools/getRecord.js';
import {getSetupAuditTrailToolDefinition} from './tools/getSetupAuditTrail.js';
import {invokeApexRestResourceToolDefinition} from './tools/invokeApexRestResource.js';
import {runApexTestToolDefinition} from './tools/runApexTest.js';
import {salesforceMcpUtilsToolDefinition, salesforceMcpUtilsToolHandler} from './tools/salesforceMcpUtils.js';
import {validateUserPermissions, getAgentInstructions} from './utils.js';

// Define state object here instead of importing it
export const state = {
	org: {},
	// currentLogLevel is no longer needed as the SDK handles log levels automatically
	userValidated: true,
	startedDate: new Date()
};

// import { chatWithAgentforceDefinition } from './tools/chatWithAgentforce.js';
// import { triggerExecutionOrderToolDefinition } from './tools/triggerExecutionOrder.js';
//import {generateSoqlQueryToolDefinition} from './tools/generateSoqlQuery.js';

//const logger = createModuleLogger(import.meta.url, 'app', state.currentLogLevel); //TODO: Remove this
const logger = createModuleLogger(import.meta.url, 'app'); //TODO: Remove this

export let resources = {};
// Flag to track if workspace path has been set
let workspacePathSet = false;

// Load agent instructions before creating the server
let serverInstructions = '';
try {
        serverInstructions = await getAgentInstructions('agentInstruccions');
} catch (error) {
        logger.warn(error, 'Failed to load agent instructions, using empty instructions');
}

async function setWorkspacePath(workspacePath) {

	// If workspace path is already set by env var, don't override it
	if (workspacePathSet) {
		logger.debug('Workspace path already set, ignoring new path');
		return;
	}

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
			targetPath = fileURLToPath(targetPath);
		} catch {
			//Fallback: manual URI conversion
			targetPath = decodeURIComponent(targetPath.replace(/^file:\/\//, ''));
			process.platform === 'win32' && (targetPath = targetPath.replace(/^\/([a-zA-Z]):/, '$1:'));
		}
	}

	logger.info(`Workspace path set to: "${targetPath}"`);

	if (targetPath) {
		if (targetPath !== process.cwd()) {
			try {
				process.chdir(targetPath);
			} catch (error) {
				logger.error(error, 'Failed to change working directory');
			}
		}
		workspacePathSet = true;
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
		// Update the watcher with the new org alias
		if (targetOrgWatcher && org?.alias) {
			targetOrgWatcher.currentOrgAlias = org.alias;
		}
	} catch (error) {
		logger.error(error, 'Error updating org and user details');
		state.org = {};
		state.userValidated = false;
	}
}

//Create the MCP server instance
const {protocolVersion, serverInfo, capabilities} = config.serverConstants;
const mcpServer = new McpServer(serverInfo, {
        capabilities,
        instructions: serverInstructions,
        debouncedNotificationMethods: ['notifications/tools/list_changed', 'notifications/resources/list_changed', 'notifications/prompts/list_changed']
});

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
		logger.error(error, `Error setting resource ${uri}, stack: ${error.stack}`);
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
const readyPromise = new Promise((resolve) => (resolveServerReady = resolve)); // transport connected
let resolveOrgReady;
const orgReadyPromise = new Promise((resolve) => (resolveOrgReady = resolve)); // org details loaded/attempted

//Server initialization function
export async function setupServer() {
	mcpServer.server.setNotificationHandler(RootsListChangedNotificationSchema, async (listRootsResult) => {
		try {
			if (client.supportsCapability('roots')) {
				try {
					listRootsResult = await mcpServer.server.listRoots();
				} catch (error) {
					logger.debug(`Requested roots list but client returned error: ${JSON.stringify(error, null, 3)}`);
				}
			}

			//Some clients use the first root to establish the workspace directory
			// Only set workspace path from roots if it hasn't been set by environment variable
			if (!workspacePathSet && listRootsResult.roots?.[0]?.uri.startsWith('file://')) {
				setWorkspacePath(listRootsResult.roots[0].uri);
			}
		} catch (error) {
			logger.error(error, 'Failed to request roots from client');
		}
	});

	mcpServer.server.setRequestHandler(ListResourcesRequestSchema, async () => ({resources: Object.values(resources)}));
	mcpServer.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({resourceTemplates: []}));
	mcpServer.server.setRequestHandler(ReadResourceRequestSchema, async ({params: {uri}}) => ({contents: [{uri, ...resources[uri]}]}));

	// mcpServer.registerPrompt('code-modification', codeModificationPromptDefinition, codeModificationPrompt);
	mcpServer.registerPrompt('apex-run-script', apexRunScriptPromptDefinition, apexRunScriptPrompt);
	mcpServer.registerPrompt('tools-basic-run', toolsBasicRunPromptDefinition, toolsBasicRunPromptHandler);

	// Handlers that we want to load statically (frequently used/core)
	const StaticToolHandlers = {
		salesforceMcpUtils: salesforceMcpUtilsToolHandler,
		executeSoqlQuery: executeSoqlQueryToolHandler,
		describeObject: describeObjectToolHandler,
		getRecord: getRecordToolHandler,
		executeAnonymousApex: executeAnonymousApexToolHandler,
		deployMetadata: deployMetadataToolHandler
	};

	const callToolHandler = (tool) => {
		// Accept both parsed args and MCP extra context (progress, sendNotification, etc.)
		return async (params, args) => {
			try {
				if (tool !== 'salesforceMcpUtils') {
					if (!state.org.user.id) {
						throw new Error('❌ Org and user details not available. The server may still be initializing.');
					} else if (!state.userValidated) {
						throw new Error(`🚫 Request blocked due to unsuccessful user validation for "${state.org.user.username}".`);
					}
				}
				// Prefer statically loaded handlers for core tools; fallback to lazy dynamic import
				let toolHandler = StaticToolHandlers[tool];
				if (!toolHandler) {
					const toolModule = await import(`./tools/${tool}.js`);
					toolHandler = toolModule?.[`${tool}ToolHandler`];
				}
				if (!toolHandler) {
					throw new Error(`Tool ${tool} module does not export a tool handler.`);
				}
				return await toolHandler(params, args);
			} catch (error) {
				logger.error(error.message, `Error calling tool ${tool}, stack: ${error.stack}`);
				return {
					isError: true,
					content: [{type: 'text', text: error.message}]
				};
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

	mcpServer.server.setRequestHandler(InitializeRequestSchema, async ({params}) => {
		try {
			const {clientInfo, capabilities: clientCapabilities, protocolVersion: clientProtocolVersion} = params;
			client.initialize({
				clientInfo,
				capabilities: clientCapabilities,
				protocolVersion: clientProtocolVersion
			});

			logger.info(`IBM Salesforce MCP server (v${config.serverConstants.serverInfo.version})`);
			const clientCapabilitiesString = `Capabilities: ${JSON.stringify(client.capabilities, null, 3)}`;
			logger.info(`Connecting with client "${client.clientInfo.name}" (v${client.clientInfo.version}). ${clientCapabilitiesString}`);

			logger.info(`Current log level: ${state.currentLogLevel}`); //TODO: Remove this
			logger.info('Log level management is now handled automatically by the SDK'); //TODO: Remove this

			if (process.env.WORKSPACE_FOLDER_PATHS) {
				setWorkspacePath(process.env.WORKSPACE_FOLDER_PATHS);
			} else if (client.supportsCapability('roots')) {
				await mcpServer.server.listRoots();
			}

			//if (client.supportsCapability('sampling')) {
			//	mcpServer.registerTool('generateSoqlQuery', generateSoqlQueryDefinition, generateSoqlQuery);
			//}

			//Execute org setup and validation after directory change is complete
			(async () => {
				try {
					// Start watching target org changes and perform initial fetch
					// process.env.HOME = process.env.HOME ;
					targetOrgWatcher.start(updateOrgAndUserDetails, state.org?.alias);
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
			logger.error(error, `Error initializing server, stack: ${error.stack}`);
			// Return a structured error via JSON-RPC by throwing a concise Error
			throw new Error(`Initialization failed: ${error.message}`);
		}
	});

	await mcpServer.connect(new StdioServerTransport()).then(() => new Promise((r) => setTimeout(r, 400)));
	if (typeof resolveServerReady === 'function') {
		resolveServerReady();
	}

	return {protocolVersion, serverInfo, capabilities};
}

export function sendProgressNotification(progressToken, progress, total, message) {
	mcpServer.server.notification({
		method: 'notifications/progress',
		params: {progressToken, progress, total, message}
	});
}

//Export the ready promise for external use
export {readyPromise};
export {orgReadyPromise};

export {mcpServer};
