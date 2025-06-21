import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	ListToolsRequestSchema,
	CallToolRequestSchema,
	ListResourcesRequestSchema,
	ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import {initServer, runCliCommand, log} from './src/utils.js';
import {salesforceState} from './src/state.js';

//Tools
import salesforceMcpUtils from './src/tools/mcpUtils.js';
import getOrgAndUserDetails from './src/tools/getOrgAndUserDetails.js';
import getCurrentDatetime from './src/tools/getCurrentDatetime.js';
import createRecord from './src/tools/createRecord.js';
import deleteRecord from './src/tools/deleteRecord.js';
import deployMetadata from './src/tools/deployMetadata.js';
import describeObject from './src/tools/describeObject.js';
import executeAnonymousApex from './src/tools/executeAnonymousApex.js';
import getRecentlyViewedRecords from './src/tools/getRecentlyViewedRecords.js';
import getRecord from './src/tools/getRecord.js';
import getSetupAuditTrail from './src/tools/getSetupAuditTrail.js';
import apexDebugLogs from './src/tools/apexDebugLogs.js';
import executeSoqlQuery from './src/tools/soqlQuery.js';
import toolingApiRequest from './src/tools/toolingApiRequest.js';
import updateRecord from './src/tools/updateRecord.js';
import triggerExecutionOrder from './src/tools/triggerExecutionOrder.js';
import metadataApiRequest from './src/tools/metadataApiRequest.js';
import chatWithAgentforce from './src/tools/chatWithAgentforce.js';
import generateSoqlQuery from './src/tools/generateSoqlQuery.js';
import test from './src/tools/test.js';

const toolImplementations = {
	salesforceMcpUtils,
	getOrgAndUserDetails,
	getCurrentDatetime,
	createRecord,
	deleteRecord,
	deployMetadata,
	describeObject,
	executeAnonymousApex,
	getRecentlyViewedRecords,
	getRecord,
	getSetupAuditTrail,
	apexDebugLogs,
	executeSoqlQuery,
	toolingApiRequest,
	updateRecord,
	triggerExecutionOrder,
	metadataApiRequest,
	chatWithAgentforce,
	generateSoqlQuery,
	test
};

//Definitions of tools
const salesforceMcpUtilsTool = {
	name: 'salesforceMcpUtils',
	title: 'Salesforce MCP Utils',
	description: 'This tool allows clearing the cache of the Salesforce MCP server.',
	inputSchema: {
		type: 'object',
		required: ['action'],
		properties: {
			action: {
				type: 'string',
				description: 'The action to perform (clearCache, refreshSObjectDefinitions, updateSfCli, refreshSfCli)'
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: true
	}
};

const getOrgAndUserDetailsTool = {
	name: 'getOrgAndUserDetails',
	title: 'Get the Salesforce organization and current user details.',
	description: 'This tool allows retrieving the Salesforce organization details like Id, Name, domain URL, etc., as well as the current user details like Id, Name, Profile, etc.',
	inputSchema: {
		type: 'object',
		properties: {}
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: false
	}
};

const getCurrentDatetimeTool = {
	name: 'getCurrentDatetime',
	title: 'Get the current datetime.',
	description: 'This tool allows retrieving the current datetime, including timezone and ISO 8601 format.',
	inputSchema: {
		type: 'object',
		properties: {}
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: false
	}
};

const createRecordTool = {
	name: 'createRecord',
	title: 'Create Record',
	description: 'This tool allows creating a record in Salesforce with the given field values.',
	inputSchema: {
		type: 'object',
		required: ['sObjectName', 'fields'],
		properties: {
			sObjectName: {
				type: 'string',
				description: 'The SObject type of the record to create.',
			},
			fields: {
				type: 'object',
				description: 'The field values to create the record with (e.g. {"Name": "New Name", "Description": "New Description"})'
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: true
	}
};

const deleteRecordTool = {
	name: 'deleteRecord',
	title: 'Delete Record',
	description: 'This tool allows deleting a record in Salesforce.',
	inputSchema: {
		type: 'object',
		required: ['sObjectName', 'recordId'],
		properties: {
			sObjectName: {
				type: 'string',
				description: 'The SObject type of the record to delete.',
			},
			recordId: {
				type: 'string',
				description: 'The ID of the record to delete.',
			}
		}
	},
	annotations: {
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: true
	}
};

const deployMetadataTool = {
	name: 'deployMetadata',
	title: 'Deploy Metadata',
	description: 'This tool allows deploying a local metadata file to the Salesforce org.',
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
		openWorldHint: true
	}
};

const describeObjectTool = {
	name: 'describeObject',
	title: 'Describe Object',
	description: 'This tool allows to get all the information of a Salesforce SObject, including its fields, relationships, and other metadata.',
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
		idempotentHint: false,
		openWorldHint: true
	}
};

const executeAnonymousApexTool = {
	name: 'executeAnonymousApex',
	title: 'Execute Anonymous Apex',
	description: 'This tool allows executing anonymous Apex code in Salesforce.',
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
		openWorldHint: true
	}
};

const getRecentlyViewedRecordsTool = {
	name: 'getRecentlyViewedRecords',
	title: 'Get Recently Viewed Records',
	description: 'This tool allows retrieving recently viewed records in Salesforce.',
	inputSchema: {
		type: 'object',
		properties: {}
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true
	}
};

const getRecordTool = {
	name: 'getRecord',
	title: 'Get Record',
	description: 'This tool allows retrieving a record in Salesforce.',
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
		openWorldHint: true
	}
};

const getSetupAuditTrailTool = {
	name: 'getSetupAuditTrail',
	title: 'Get the changes in the Salesforce org metadata performed in the last days from the Salesforce Setup Audit Trail data',
	description: 'This tool allows retrieving a list of the configuration changes performed in the Salesforce org metadata.',
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
		openWorldHint: true
	}
};

const apexDebugLogsTool = {
	name: 'apexDebugLogs',
	title: 'Manage Apex debug logs',
	description: 'This tool allows activating, deactivating, checking status or retrieving the debug logs in Salesforce.',
	inputSchema: {
		type: 'object',
		required: ['action'],
		properties: {
			action: {
				type: 'string',
				description: 'Whether to activate ("on"), deactivate ("off"), checking status ("status") or retrieve ("list", "get") the debug logs'
			},
			logId: {
				type: 'string',
				description: 'The Id of the log to retrieve',
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: true
	}
};

const executeSoqlQueryTool = {
	name: 'executeSoqlQuery',
	title: 'Execute SOQL Query',
	description: 'This tool allows executing SOQL queries using Salesforce CLI.',
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
		idempotentHint: false,
		openWorldHint: true
	}
};

const toolingApiRequestTool = {
	name: 'toolingApiRequest',
	title: 'Make Tooling API Request',
	description: 'This tool allows making a tooling API request in Salesforce.',
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
		openWorldHint: true
	}
};

const updateRecordTool = {
	name: 'updateRecord',
	title: 'Update Record',
	description: 'This tool allows updating a record in Salesforce.',
	inputSchema: {
		type: 'object',
		required: ['sObjectName', 'recordId', 'fields'],
		properties: {
			sObjectName: {
				type: 'string',
				description: 'The name of the SObject to update.'
			},
			recordId: {
				type: 'string',
				description: 'The Id of the record to update.'
			},
			fields: {
				type: 'object',
				description: 'The field values to update the record with (e.g. {"Name": "New Name", "Description": "New Description"})'
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: true
	}
};

const metadataApiRequestTool = {
	name: 'metadataApiRequest',
	title: 'Retrieve Metadata',
	description: 'This tool allows retrieving metadata from Salesforce using force:source:retrieve.',
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
		idempotentHint: false,
		openWorldHint: true
	}
};

const generateSoqlQueryTool = {
	name: 'generateSoqlQuery',
	title: 'Generate SOQL Query',
	description: 'This tool allows generating a SOQL query based on a description and involved SObjects.',
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
				description: 'The SObjects involved in the query (e.g. ["Account", "Contact"])',
				items: {
					type: 'string'
				}
			}
		}
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true
	}
};

const testTool = {
	name: 'test',
	title: 'Test Tool',
	description: 'This is a test tool.',
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
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: false
	}
};

const server = new Server({name: 'salesforce-mcp', version: '1.0.0'}, {
	capabilities: {
		logging: {},
		resources: {},
		prompts: {},
		tools: {
			salesforceMcpUtilsTool,
			getOrgAndUserDetailsTool,
			getCurrentDatetimeTool,
			createRecordTool,
			deleteRecordTool,
			deployMetadataTool,
			describeObjectTool,
			executeAnonymousApexTool,
			getRecentlyViewedRecordsTool,
			getRecordTool,
			getSetupAuditTrailTool,
			apexDebugLogsTool,
			executeSoqlQueryTool,
			toolingApiRequestTool,
			updateRecordTool,
			generateSoqlQueryTool,
			metadataApiRequestTool,
			testTool
			//triggerExecutionOrderTool,
			//chatWithAgentforceTool
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
			getCurrentDatetimeTool,
			createRecordTool,
			deleteRecordTool,
			deployMetadataTool,
			describeObjectTool,
			executeAnonymousApexTool,
			getRecentlyViewedRecordsTool,
			getRecordTool,
			getSetupAuditTrailTool,
			apexDebugLogsTool,
			executeSoqlQueryTool,
			toolingApiRequestTool,
			updateRecordTool,
			generateSoqlQueryTool,
			metadataApiRequestTool,
			testTool
			//triggerExecutionOrderTool,
			//chatWithAgentforceTool
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