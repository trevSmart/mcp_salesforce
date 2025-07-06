import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const pkg = require('./package.json');
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	ListToolsRequestSchema,
	CallToolRequestSchema,
	//ListResourcesRequestSchema,
	//ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import {initServer, log, loadToolDescription} from './src/utils.js';
import {salesforceState} from './src/state.js';

//Tools
import salesforceMcpUtils from './src/tools/salesforceMcpUtils.js';
import getOrgAndUserDetailsTool from './src/tools/getOrgAndUserDetailsTool.js';
import dmlOperation from './src/tools/dmlOperationTool.js';
import deployMetadataTool from './src/tools/deployMetadataTool.js';
import describeObjectTool from './src/tools/describeObjectTool.js';
import executeAnonymousApexTool from './src/tools/executeAnonymousApexTool.js';
import getRecentlyViewedRecordsTool from './src/tools/getRecentlyViewedRecordsTool.js';
import getRecordTool from './src/tools/getRecordTool.js';
import getSetupAuditTrailTool from './src/tools/getSetupAuditTrailTool.js';
import apexDebugLogs from './src/tools/apexDebugLogs.js';
import executeSoqlQueryTool from './src/tools/soqlQueryTool.js';
import toolingApiRequest from './src/tools/toolingApiRequest.js';
import triggerExecutionOrder from './src/tools/triggerExecutionOrder.js';
import metadataApiRequest from './src/tools/metadataApiRequest.js';
import chatWithAgentforce from './src/tools/chatWithAgentforce.js';
import generateSoqlQuery from './src/tools/generateSoqlQueryTool.js';
import runApexTest from './src/tools/runApexTest.js';

const toolImplementations = {
	salesforceMcpUtils: salesforceMcpUtils,
	getOrgAndUserDetails: getOrgAndUserDetailsTool,
	dmlOperation: dmlOperation,
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
	runApexTest: runApexTest
};

//Definitions of tools
//#region
const salesforceMcpUtilsToolDefinition = {
	name: 'salesforceMcpUtils',
	title: 'Salesforce MCP Utils',
	description: loadToolDescription('salesforceMcpUtils'),
	inputSchema: {
		type: 'object',
		required: ['action'],
		properties: {
			action: {
				type: 'string',
				description: 'The action to perform, possible values: "clearCache", "refreshSObjectDefinitions", "getCurrentDatetime"'
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: false,
		title: 'Salesforce MCP Utils'
	}
};

const getOrgAndUserDetailsToolDefinition = {
	name: 'getOrgAndUserDetails',
	title: 'Get the Salesforce organization and current user details.',
	description: loadToolDescription('getOrgAndUserDetails'),
	inputSchema: {
		type: 'object',
		properties: {}
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: false,
		title: 'Get the Salesforce organization and current user details.'
	}
};

const dmlOperationToolDefinition = {
	name: 'dmlOperation',
	title: 'DML Operation (create, update or delete a record)',
	description: loadToolDescription('dmlOperation'),
	inputSchema: {
		type: 'object',
		required: ['operation', 'sObjectName', 'fields'],
		properties: {
			operation: {
				type: 'string',
				description: 'The DML operation to perform. Possible values: "create", "update", "delete".'
			},
			sObjectName: {
				type: 'string',
				description: 'The SObject type of the record.'
			},
			recordId: {
				type: 'string',
				description: 'Only applicable for operations "update" and "delete". The ID of the record.'
			},
			fields: {
				type: 'object',
				description: 'Required (For "delete" operation, pass {}). An object with the field values for the record. E.g. {"Name": "New Name", "Description": "New Description"}.'
			}
		}
	},
	annotations: {
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'DML Operation'
	}
};

const deployMetadataToolDefinition = {
	name: 'deployMetadata',
	title: 'Deploy Metadata',
	description: loadToolDescription('deployMetadata'),
	inputSchema: {
		type: 'object',
		required: ['sourceDir'],
		properties: {
			sourceDir: {
				type: 'string',
				description: 'The path to the local metadata file to deploy.',
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Deploy Metadata'
	}
};

const describeObjectToolDefinition = {
	name: 'describeObject',
	title: 'Describe Object',
	description: loadToolDescription('describeObject'),
	inputSchema: {
		type: 'object',
		required: ['sObjectName'],
		properties: {
			sObjectName: {
				type: 'string',
				description: 'The name of the SObject to describe'
			}
		}
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Describe Object'
	}
};

const executeAnonymousApexToolDefinition = {
	name: 'executeAnonymousApex',
	title: 'Execute Anonymous Apex',
	description: loadToolDescription('executeAnonymousApex'),
	inputSchema: {
		type: 'object',
		required: ['apexCode'],
		properties: {
			apexCode: {
				type: 'string',
				description: 'The Apex code to execute'
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Execute Anonymous Apex'
	}
};

const getRecentlyViewedRecordsToolDefinition = {
	name: 'getRecentlyViewedRecords',
	title: 'Get Recently Viewed Records',
	description: loadToolDescription('getRecentlyViewedRecords'),
	inputSchema: {
		type: 'object',
		properties: {}
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Get Recently Viewed Records'
	}
};

const getRecordToolDefinition = {
	name: 'getRecord',
	title: 'Get Record',
	description: loadToolDescription('getRecord'),
	inputSchema: {
		type: 'object',
		required: ['sObjectName', 'recordId'],
		properties: {
			sObjectName: {
				type: 'string',
				description: 'The name of the SObject type of the record to retrieve.',
			},
			recordId: {
				type: 'string',
				description: 'The Id of the record to retrieve.',
			}
		}
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Get Record'
	}
};

const getSetupAuditTrailToolDefinition = {
	name: 'getSetupAuditTrail',
	title: 'Get the changes in the Salesforce org metadata performed in the last days from the Salesforce Setup Audit Trail data',
	description: loadToolDescription('getSetupAuditTrail'),
	inputSchema: {
		type: 'object',
		required: ['lastDays', 'createdByName'],
		properties: {
			lastDays: {
				type: 'number',
				description: 'Number of days to query (between 1 and 90)'
			},
			createdByName: {
				type: 'string',
				description: 'Only the changes performed by this user will be returned (null to return changes from all users)'
			},
			metadataName: {
				type: 'string',
				description: 'Name of the file or folder to get the changes of (e.g. "FOO_AlertMessages_Controller", "FOO_AlertMessage__c", "FOO_AlertNessageList_LWC", etc.)'
			},
		},
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Get the changes in the Salesforce org metadata performed in the last days from the Salesforce Setup Audit Trail data'
	}
};

const apexDebugLogsToolDefinition = {
	name: 'apexDebugLogs',
	title: 'Apex Debug Logs',
	description: loadToolDescription('apexDebugLogs'),
	inputSchema: {
		type: 'object',
		required: ['action'],
		properties: {
			action: {
				type: 'string',
				description: 'The action to perform. Possible values: "start", "stop", "get".'
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Apex Debug Logs'
	}
};

const soqlQueryToolDefinition = {
	name: 'executeSoqlQuery',
	title: 'Execute SOQL Query',
	description: loadToolDescription('soqlQuery'),
	inputSchema: {
		type: 'object',
		required: ['query'],
		properties: {
			query: {
				type: 'string',
				description: 'The SOQL query to execute'
			},
			useToolingApi: {
				type: 'boolean',
				description: 'Whether to use the Tooling API for the query (default: false)'
			}
		}
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Execute SOQL Query'
	}
};

const toolingApiRequestToolDefinition = {
	name: 'toolingApiRequest',
	title: 'Tooling API Request',
	description: loadToolDescription('toolingApiRequest'),
	inputSchema: {
		type: 'object',
		required: ['method', 'endpoint'],
		properties: {
			method: {
				type: 'string',
				description: 'The HTTP method to use (GET, POST, PUT, DELETE)'
			},
			endpoint: {
				type: 'string',
				description: 'The endpoint to request (e.g. "/tooling/query/?q=SELECT+Name+FROM+ApexClass+LIMIT+10")'
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Tooling API Request'
	}
};

const triggerExecutionOrderToolDefinition = {
	name: 'triggerExecutionOrder',
	title: 'Trigger Execution Order',
	description: loadToolDescription('triggerExecutionOrder'),
	inputSchema: {
		type: 'object',
		required: ['sObjectName'],
		properties: {
			sObjectName: {
				type: 'string',
				description: 'The name of the SObject to retrieve the trigger execution order for.'
			}
		}
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Trigger Execution Order'
	}
};

const metadataApiRequestToolDefinition = {
	name: 'metadataApiRequest',
	title: 'Metadata API Request',
	description: loadToolDescription('metadataApiRequest'),
	inputSchema: {
		type: 'object',
		required: ['metadataType'],
		properties: {
			metadataType: {
				type: 'string',
				description: 'The type of metadata to retrieve (e.g. "Flow", "ApexClass", "CustomObject")'
			},
			targetUsername: {
				type: 'string',
				description: 'The username or alias of the target org (optional)'
			}
		}
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Metadata API Request'
	}
};

const chatWithAgentforceToolDefinition = {
	name: 'chatWithAgentforce',
	title: 'Chat with Agentforce',
	description: loadToolDescription('chatWithAgentforce'),
	inputSchema: {
		type: 'object',
		required: ['message'],
		properties: {
			message: {
				type: 'string',
				description: 'The message to send to Agentforce.'
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Chat with Agentforce'
	}
};

const generateSoqlQueryToolDefinition = {
	name: 'generateSoqlQuery',
	title: 'Generate SOQL Query',
	description: loadToolDescription('generateSoqlQuery'),
	inputSchema: {
		type: 'object',
		required: ['soqlQueryDescription', 'involvedSObjects'],
		properties: {
			soqlQueryDescription: {
				type: 'string',
				description: 'The description of the SOQL query to generate'
			},
			involvedSObjects: {
				type: 'array',
				items: {
					type: 'string'
				},
				description: 'The SObjects involved in the query (e.g. ["Account", "Contact"])'
			}
		}
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Generate SOQL Query'
	}
};

const runApexTestToolDefinition = {
	name: 'runApexTest',
	title: 'Run Apex Test',
	description: loadToolDescription('runApexTest'),
	inputSchema: {
		type: 'object',
		required: ['className'],
		properties: {
			className: {
				type: 'string',
				description: 'Name of the Apex test class to run.'
			},
			methodName: {
				type: 'string',
				description: 'Name of the test method to run (optional).'
			}
		}
	},
	annotations: {
		testHint: true,
		destructiveHint: true,
		readOnlyHint: false,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Run Apex Test'
	}
};
//#endregion

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
	apexDebugLogsToolDefinition,
	soqlQueryToolDefinition,
	toolingApiRequestToolDefinition,
	triggerExecutionOrderToolDefinition,
	metadataApiRequestToolDefinition,
	chatWithAgentforceToolDefinition,
	generateSoqlQueryToolDefinition,
	runApexTestToolDefinition
];

//Definir la versió del servidor en una constant
const SERVER_VERSION = pkg.version;

const server = new Server({name: 'salesforce-mcp', version: SERVER_VERSION}, {
	capabilities: {
		//logging: {},
		//resources: {},
		//prompts: {},
		tools: Object.fromEntries(toolDefinitions.map(def => [def.name, def]))
	}
});

salesforceState.server = server;

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
		log('Initializing server...', 'debug');
		await initServer();
		await server.connect(transport);
		log('Server initialized and running', 'debug');

	} catch (error) {
		log(`Error starting IBM MCP Salesforce server: ${error.message}`, 'error');
		process.exit(1);
	}
}

await main();