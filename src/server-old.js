import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';

import {
	SetLevelRequestSchema,
	InitializeRequestSchema,
	ListResourcesRequestSchema
	//RootsListChangedNotificationSchema,
	//ListToolsRequestSchema,
	//CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import {log, validateUserPermissions} from './utils.js';
import {getOrgAndUserDetails} from './salesforceServices.js';
import {config} from './config.js';
import state from './state.js';
import client from './client.js';

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
import {apexDebugLogsToolDefinition, apexDebugLogsTool} from './tools/apexDebugLogs.js';

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

class Server {
	server;

	get serverLowLevel() {
		return this.server.server;
	}

	resources = {};

	resolveServerReady;

	readyPromise = new Promise(resolve => this.resolveServerReady = resolve);

	constructor() {
		const {serverInfo, capabilities, instructions} = SERVER_CONSTANTS;
		this.server = new McpServer(serverInfo, {capabilities, instructions, debouncedNotificationMethods: [
			'notifications/tools/list_changed',
			'notifications/resources/list_changed',
			'notifications/prompts/list_changed'
		]});
	}

	async init() {
		/*


		/*
		//Register resources
		server.setRequestHandler(ReadResourceRequestSchema, async request => {
			const uri = request?.uri || request?.params?.uri;
			const resource = state.resources[uri];
			return {contents: [resource]};
		});
		*/

		/*

		const callToolRequestHandler = async request => {
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
		*/

		this.serverLowLevel.setRequestHandler(ListResourcesRequestSchema, async () => ({resources: Object.values(this.resources)}));

		this.server.registerPrompt('code-modification', codeModificationPromptDefinition, codeModificationPrompt);

		this.server.registerTool('salesforceMcpUtils', salesforceMcpUtilsToolDefinition, salesforceMcpUtilsTool);
		this.server.registerTool('getOrgAndUserDetails', getOrgAndUserDetailsToolDefinition, getOrgAndUserDetailsTool);
		this.server.registerTool('dmlOperation', dmlOperationToolDefinition, dmlOperationTool);
		this.server.registerTool('deployMetadata', deployMetadataToolDefinition, deployMetadataTool);
		this.server.registerTool('describeObject', describeObjectToolDefinition, describeObjectTool);
		this.server.registerTool('executeAnonymousApex', executeAnonymousApexToolDefinition, executeAnonymousApexTool);
		this.server.registerTool('getRecentlyViewedRecords', getRecentlyViewedRecordsToolDefinition, getRecentlyViewedRecordsTool);
		this.server.registerTool('getRecord', getRecordToolDefinition, getRecordTool);
		this.server.registerTool('getSetupAuditTrail', getSetupAuditTrailToolDefinition, getSetupAuditTrailTool);
		this.server.registerTool('executeSoqlQuery', executeSoqlQueryToolDefinition, executeSoqlQueryTool);
		this.server.registerTool('runApexTest', runApexTestToolDefinition, runApexTestTool);
		this.server.registerTool('apexDebugLogs', apexDebugLogsToolDefinition, apexDebugLogsTool);

		this.serverLowLevel.setRequestHandler(SetLevelRequestSchema, async ({params}) => {
			config.setLogLevel(params.level);
			return {};
		});
		this.serverLowLevel.setRequestHandler(InitializeRequestSchema, async ({params}) => {
			try {
				const {clientInfo, capabilities, protocolVersion} = params;
				client.initialize({clientInfo, capabilities, protocolVersion});

				log(`IBM Salesforce MCP server (v${SERVER_CONSTANTS.serverInfo.version})`, 'notice');
				log(`Connecting with client: "${client.clientInfo.name} (v${client.clientInfo.version})"`, 'notice');
				log(`Client capabilities: ${JSON.stringify(client.capabilities, null, '3')}`, 'debug');

				return {
					protocolVersion: SERVER_CONSTANTS.protocolVersion,
					serverInfo: SERVER_CONSTANTS.serverInfo,
					capabilities: SERVER_CONSTANTS.capabilities
				};

			} catch (error) {
				log(`Error initializing server: ${error.message}`, 'error');
				throw error;
			}
		});

		await this.server.connect(new StdioServerTransport()).then(() => new Promise(r => setTimeout(r, 400)));

		config.workspacePath && log(`Working directory: "${config.workspacePath}"`, 'debug');

		return {
			protocolVersion: SERVER_CONSTANTS.protocolVersion,
			serverInfo: SERVER_CONSTANTS.serverInfo,
			capabilities: SERVER_CONSTANTS.capabilities
		};
	}

	async waitForReady() {
		return this.readyPromise;
	}

	setReady() {
		if (typeof this.resolveServerReady === 'function') {
			this.resolveServerReady();
		}
	}

	async sendElicitRequest(elicitationProperties) {
		if (client.supportsCapability('elicitation')) {
			const elicitationResult = await this.server.server.elicitInput({
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

	newResource(uri, mimeType = 'text/plain', content, annotations = {}) {
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
			this.resources[uri] = resource;

			if (client.supportsCapability('resources')) {
				this.serverLowLevel.sendResourceListChanged();
			}
			return resource;

		} catch (error) {
			log(`Error setting resource ${uri}: ${error.message}`, 'error');
		}
	}
}

let server = new Server();
export default server;