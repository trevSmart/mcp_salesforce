import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	ListToolsRequestSchema,
	CallToolRequestSchema,
	ListResourcesRequestSchema,
	ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import {initServer, runCliCommand, log, loadToolDescription} from './src/utils.js';
import {salesforceState} from './src/state.js';

//Tools
import salesforceMcpUtils from './src/tools/salesforceMcpUtils.js';
import getOrgAndUserDetails from './src/tools/getOrgAndUserDetails.js';
import dmlOperation from './src/tools/dmlOperation.js';
import deployMetadata from './src/tools/deployMetadata.js';
import describeObject from './src/tools/describeObject.js';
import executeAnonymousApex from './src/tools/executeAnonymousApex.js';
import getRecentlyViewedRecords from './src/tools/getRecentlyViewedRecords.js';
import getRecord from './src/tools/getRecord.js';
import getSetupAuditTrail from './src/tools/getSetupAuditTrail.js';
import apexDebugLogs from './src/tools/apexDebugLogs.js';
import executeSoqlQuery from './src/tools/soqlQuery.js';
import toolingApiRequest from './src/tools/toolingApiRequest.js';
import triggerExecutionOrder from './src/tools/triggerExecutionOrder.js';
import metadataApiRequest from './src/tools/metadataApiRequest.js';
import chatWithAgentforce from './src/tools/chatWithAgentforce.js';
import generateSoqlQuery from './src/tools/generateSoqlQuery.js';
import test from './src/tools/test.js';
import runApexTest from './src/tools/runApexTest.js';

const toolImplementations = {
	salesforceMcpUtils,
	getOrgAndUserDetails,
	dmlOperation,
	deployMetadata,
	describeObject,
	executeAnonymousApex,
	getRecentlyViewedRecords,
	getRecord,
	getSetupAuditTrail,
	apexDebugLogs,
	executeSoqlQuery,
	toolingApiRequest,
	triggerExecutionOrder,
	metadataApiRequest,
	chatWithAgentforce,
	generateSoqlQuery,
	test,
	runApexTest
};

//Definitions of tools
const salesforceMcpUtilsTool = {
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

const getOrgAndUserDetailsTool = {
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

const dmlOperationTool = {
	name: 'dmlOperation',
	title: 'DML Operation',
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
				description: 'Only applicable for operations "create" and "update". An object with the field values for the record. E.g. {"Name": "New Name", "Description": "New Description"}'
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

const deployMetadataTool = {
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

const describeObjectTool = {
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

const executeAnonymousApexTool = {
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

const getRecentlyViewedRecordsTool = {
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

const getRecordTool = {
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

const getSetupAuditTrailTool = {
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

const apexDebugLogsTool = {
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

const soqlQueryTool = {
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

const toolingApiRequestTool = {
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

const triggerExecutionOrderTool = {
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

const metadataApiRequestTool = {
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

const chatWithAgentforceTool = {
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

const generateSoqlQueryTool = {
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

const testTool = {
	name: 'test',
	title: 'Test Tool',
	description: loadToolDescription('test'),
	inputSchema: {
		type: 'object',
		properties: {
			param1: {
				type: 'string',
				description: 'Generic input parameter.'
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: false,
		title: 'Test Tool'
	}
};

const runApexTestTool = {
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

const tools = [
	salesforceMcpUtilsTool,
	getOrgAndUserDetailsTool,
	dmlOperationTool,
	deployMetadataTool,
	describeObjectTool,
	executeAnonymousApexTool,
	getRecentlyViewedRecordsTool,
	getRecordTool,
	getSetupAuditTrailTool,
	apexDebugLogsTool,
	soqlQueryTool,
	toolingApiRequestTool,
	triggerExecutionOrderTool,
	metadataApiRequestTool,
	chatWithAgentforceTool,
	generateSoqlQueryTool,
	testTool,
	runApexTestTool
];

const resources = [];

const server = new Server({name: 'salesforce-mcp', version: '1.0.0'}, {
	capabilities: {
		logging: {},
		resources: {},
		prompts: {},
		tools: {
			salesforceMcpUtilsTool,
			getOrgAndUserDetailsTool,
			dmlOperationTool,
			deployMetadataTool,
			describeObjectTool,
			executeAnonymousApexTool,
			getRecentlyViewedRecordsTool,
			getRecordTool,
			getSetupAuditTrailTool,
			apexDebugLogsTool,
			soqlQueryTool,
			toolingApiRequestTool,
			triggerExecutionOrderTool,
			metadataApiRequestTool,
			chatWithAgentforceTool,
			generateSoqlQueryTool,
			testTool,
			runApexTestTool
		}
	}
});

salesforceState.server = server;

server.setRequestHandler(ListResourcesRequestSchema, async () => ({resources: [{
	uri: 'file:///orgDetails.json',
	name: 'Org details',
	mimeType: 'text/plain',
	description: 'Org details'
}]}));

server.setRequestHandler(ReadResourceRequestSchema, async request => {
	const uri = request.params.uri;
	if (uri === 'file:///orgDetails.json') {
		return {contents: [{uri, mimeType: 'text/plain', text: JSON.stringify(salesforceState.orgDescription)}]};
	}
	throw new Error('Resource not found');
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
	log('ListToolsRequestSchema', 'debug');
	return {
		tools: [
			salesforceMcpUtilsTool,
			getOrgAndUserDetailsTool,
			dmlOperationTool,
			deployMetadataTool,
			describeObjectTool,
			executeAnonymousApexTool,
			getRecentlyViewedRecordsTool,
			getRecordTool,
			getSetupAuditTrailTool,
			apexDebugLogsTool,
			soqlQueryTool,
			toolingApiRequestTool,
			triggerExecutionOrderTool,
			metadataApiRequestTool,
			chatWithAgentforceTool,
			generateSoqlQueryTool,
			testTool,
			runApexTestTool
		]
	};
});

async function callToolRequestSchemaHandler(request) {
	const {name, arguments: args, _meta = {}} = request.params;

	const progressToken = _meta.progressToken;

	try {
		log(`Executing tool: "${name}" with args: ${JSON.stringify(args, null, ' ')}`);
		let result;

		if (!salesforceState.orgDescription) {
			await initServer();

			if (!salesforceState.orgDescription) {
				const orgs = JSON.parse(await runCliCommand('sf org list auth --json'))?.result.map(o => o.alias);
				return {
					isError: true,
					content: [{
						type: 'text',
						text: [
							'❌ *No default org set*. Message:',
							'```markdown',
							'Please set a default org using the command:',
							'',
							'```bash',
							'sf config set target-org "<orgAlias>"',
							'```',
							'',
							'*Available orgs:*',
							orgs.map(o => `- ${o.trim()}`).join('\n'),
							'```'
						].join('\n')
					}]
				};
			}
		}

		const toolFunction = toolImplementations[name];
		if (toolFunction) {
			result = await toolFunction(args, _meta);
		} else {
			throw new Error(`Unknown tool: ${name}`);
		}

		//If the tool already returns an object with the correct format, we return it directly
		if (result && result.content) {
			return result;
		}
	} catch (error) {
		log(`Error executing ${name}:`, error);
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

/*
export async function testToolHandler(request) {
	orgDescription = {
		accessToken: '00DKN0000000yy5!AQYAQC7Y2CcH.RQPdXVJHtnuyr0GoclFfQNi48y6OP_P6Cqog4p87Umqx3uw.fLnVoniwst4T1UxOtkMiGCKdn0wPREzuhDu',
		instanceUrl: 'https://caixabankcc--devservice.sandbox.my.salesforce.com',
		username: 'u0190347@cc-caixabank.com.devservice',
		alias: 'DEVSERVICE'
	};

	return await callToolRequestSchemaHandler(request);
}
*/

const transport = new StdioServerTransport();

try {
	log('Connecting to IBM MCP Salesforce server...', 'debug');
	await server.connect(transport);
	setTimeout(async () => {
		await initServer();
		const soqlUserQuery = `SELECT Name FROM User WHERE Id = '${salesforceState.userDescription.id}'`;
		const soqlUserResult = await runCliCommand(`sf data query --query "${soqlUserQuery.replace(/"/g, '\\"')}" -o "${salesforceState.orgDescription.alias}" --json`);
		salesforceState.userDescription.name = JSON.parse(soqlUserResult)?.result?.records?.[0]?.Name;
	}, 100);

} catch (error) {
	log('Error starting IBM MCP Salesforce server:', error);
	process.exit(1);
}