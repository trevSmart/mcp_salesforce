import {CONFIG} from './src/config.js';

import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema} from '@modelcontextprotocol/sdk/types.js';

import {initServer, runCliCommand, log} from './src/utils.js';

//Tools
import clearCache from './src/tools/mcpUtils.js';
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

let orgDescription;
let userDescription;

export function getOrgDescription() {
	return orgDescription;
}

export function setOrgDescription(newOrgDescription) {
	orgDescription = newOrgDescription;
}

export function getUserDescription() {
	return userDescription;
}

export function getCurrentAccessToken() {
	return orgDescription.accessToken;
}

export function setCurrentAccessToken(newAccessToken) {
	orgDescription.accessToken = newAccessToken;
}

//Definició dels tools
const clearCacheTool = {
	name: 'clearCache',
	description: 'This tool allows clearing the cache of the Salesforce MCP server.',
	inputSchema: {
		type: 'object',
		properties: {}
	},
	annotations: {
		title: 'Clear the cache of the Salesforce MCP server.',
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: false
	}
};

const getOrgAndUserDetailsTool = {
	name: 'getOrgAndUserDetails',
	description: 'This tool allows retrieving the Salesforce organization details like Id, Name, domain url, etc., as well as the current user details like Id, Name, Profile, etc..',
	inputSchema: {
		type: 'object',
		properties: {}
	},
	annotations: {
		title: 'Get the Salesforce organization and current user details.',
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: false
	}
};

const getCurrentDatetimeTool = {
	name: 'getCurrentDatetime',
	description: 'This tool allows retrieving the current datetime, including timezone and ISO 8601 format.',
	inputSchema: {
		type: 'object',
		properties: {}
	},
	annotations: {
		title: 'Get the current datetime.',
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: false
	}
};

const createRecordTool = {
	name: 'createRecord',
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
		},
		annotations: {
			title: 'Create Record',
			readOnlyHint: false,
			idempotentHint: false,
			openWorldHint: true
		}
	}
};

const deleteRecordTool = {
	name: 'deleteRecord',
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
		title: 'Delete Record',
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: true
	}
};

const deployMetadataTool = {
	name: 'deployMetadata',
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
		title: 'Deploy Metadata',
		readOnlyHint: false,
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: true
	}
};

const describeObjectTool = {
	name: 'describeObject',
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
		title: 'Describe Object',
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true
	}
};

const executeAnonymousApexTool = {
	name: 'executeAnonymousApex',
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
		title: 'Execute Anonymous Apex',
		readOnlyHint: false,
		idempotentHint: true,
		openWorldHint: true
	}
};

const getRecentlyViewedRecordsTool = {
	name: 'getRecentlyViewedRecords',
	description: 'This tool allows retrieving recently viewed records in Salesforce.',
	inputSchema: {
		type: 'object',
		properties: {}
	},
	annotations: {
		title: 'Get Recently Viewed Records',
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true
	}
};

const getRecordTool = {
	name: 'getRecord',
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
		title: 'Get Record',
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true
	}
};

const getSetupAuditTrailTool = {
	name: 'getSetupAuditTrail',
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
		title: 'Get the changes in the Salesforce org metadata performed in the last days from the Salesforce Setup Audit Trail data',
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true
	}
};

const apexDebugLogsTool = {
	name: 'apexDebugLogs',
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
		title: 'Manage Apex debug logs',
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: true
	}
};

const executeSoqlQueryTool = {
	name: 'executeSoqlQuery',
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
		title: 'Execute SOQL Query',
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true
	}
};

const toolingApiRequestTool = {
	name: 'toolingApiRequest',
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
		title: 'Make Tooling API Request',
		openWorldHint: true
	}
};

const updateRecordTool = {
	name: 'updateRecord',
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
		title: 'Update Record',
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: true
	}
};

/*
const triggerExecutionOrderTool = {
	name: 'triggerExecutionOrder',
	description: 'This tool analyzes the execution order of all automation components (triggers, flows, processes, etc.) for a given SObject and DML operation.',
	inputSchema: {
		type: 'object',
		required: ['sObjectName', 'operation'],
		properties: {
			sObjectName: {
				type: 'string',
				description: 'The API name of the SObject to analyze'
			},
			operation: {
				type: 'string',
				description: 'The DML operation (insert, update, or delete)'
			}
		}
	},
	annotations: {
		title: 'Trigger Execution Order',
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true
	}
};

const chatWithAgentforceTool = {
	name: 'chatWithAgentforce',
	description: 'This tool allows you to chat with an Einstein GPT agent configured in Salesforce.',
	inputSchema: {
		type: 'object',
		required: ['message'],
		properties: {
			message: {
				type: 'string',
				description: 'The message to send to the agent'
			}
		}
	},
	annotations: {
		title: 'Chat with Agentforce agent',
		openWorldHint: true
	}
};
*/

const metadataApiRequestTool = {
	name: 'metadataApiRequest',
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
		title: 'Retrieve Metadata',
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true
	}
};

const generateSoqlQueryTool = {
	name: 'generateSoqlQuery',
	description: 'Esta herramienta permite generar y ejecutar consultas SOQL de manera estructurada, con soporte para condiciones, ordenamiento y límites.',
	inputSchema: {
		type: 'object',
		required: ['soqlQueryDescription'],
		properties: {
			soqlQueryDescription: {
				type: 'string',
				description: 'Descripción de la consulta SOQL'
			},
			involvedSObjects: {
				type: 'array',
				description: 'SObjects involucrats en la consulta (per exemple ["Account", "Contact"])',
				items: {
					type: 'string'
				},
				minItems: 1,
				uniqueItems: true
			}
		}
	},
	annotations: {
		title: 'Generar consulta SOQL',
		readOnlyHint: true,
		idempotentHint: false,
		openWorldHint: true
	}
};

const server = new Server(
	{
		name: 'salesforce-mcp',
		version: '1.0.0',
	},
	{
		capabilities: {
			logging: {},
			resources: {},
			prompts: {},
			tools: {
				listChanged: true,
				clearCacheTool,
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
				metadataApiRequestTool
				//triggerExecutionOrderTool,
				//chatWithAgentforceTool
			},
		}
	}
);

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
	resources: [
		{
			uri: 'file:///orgDetails.json',
			name: 'Org details',
			mimeType: 'text/plain',
			description: 'Org details'
		}
	]
}));

server.setRequestHandler(ReadResourceRequestSchema, async request => {
	const uri = request.params.uri;

	if (uri === 'file:///orgDetails.json') {
		return {
			contents: [
				{
					uri,
					mimeType: 'text/plain',
					text: JSON.stringify(orgDescription)
				}
			]
		};
	}

	throw new Error('Resource not found');
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: [
		clearCacheTool,
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
		metadataApiRequestTool
		//triggerExecutionOrderTool,
		//chatWithAgentforceTool
	]
}));

async function callToolRequestSchemaHandler(request) {
	const {name, arguments: args, _meta = {}} = request.params;

	try {
		let result;
		log(`Executing tool: "${name}" with args: ${JSON.stringify(args, null, ' ')}`);

		if (!orgDescription) {
			({orgDescription, userDescription} = await initServer());
			if (!orgDescription) {
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

		if (name === 'clearCache') {
			result = await clearCache(args, _meta);
		} else if (name === 'getOrgAndUserDetails') {
			result = await getOrgAndUserDetails(args, _meta);
		} else if (name === 'getCurrentDatetime') {
			result = await getCurrentDatetime(args, _meta);
		} else if (name === 'createRecord') {
			result = await createRecord(args, _meta);
		} else if (name === 'deleteRecord') {
			result = await deleteRecord(args, _meta);
		} else if (name === 'deployMetadata') {
			result = await deployMetadata(args, _meta);
		} else if (name === 'describeObject') {
			result = await describeObject(args, _meta);
		} else if (name === 'executeAnonymousApex') {
			result = await executeAnonymousApex(args, _meta);
		} else if (name === 'getRecentlyViewedRecords') {
			result = await getRecentlyViewedRecords(args, _meta);
		} else if (name === 'getRecord') {
			result = await getRecord(args, _meta);
		} else if (name === 'getSetupAuditTrail') {
			result = await getSetupAuditTrail(args, _meta);
		} else if (name === 'apexDebugLogs') {
			result = await apexDebugLogs(args, _meta);
		} else if (name === 'executeSoqlQuery') {
			result = await executeSoqlQuery(args, _meta);
		} else if (name === 'toolingApiRequest') {
			result = await toolingApiRequest(args, _meta);
		} else if (name === 'updateRecord') {
			result = await updateRecord(args, _meta);
		} else if (name === 'triggerExecutionOrder') {
			result = await triggerExecutionOrder(args, _meta);
		} else if (name === 'metadataApiRequest') {
			result = await metadataApiRequest(args, _meta);
		} else if (name === 'chatWithAgentforce') {
			result = await chatWithAgentforce(args, _meta);
		} else if (name === 'generateSoqlQuery') {
			result = await generateSoqlQuery(args, _meta);
		} else {
			throw new Error(`Unknown tool: ${name}`);
		}

		//Si la tool ja retorna un objecte amb el format correcte, el retornem directament
		if (result && result.content) {
			return result;
		}
	} catch (error) {
		log(`Error executing ${name}:`, error);
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
	await server.connect(transport);
	log('IBM MCP Salesforce server started successfully');
	setTimeout(async () => {
		({orgDescription, userDescription} = await initServer());

		const soqlUserQuery = `SELECT Name FROM User WHERE Id = '${userDescription.id}'`;
		const soqlUserResult = await executeSoqlQuery({query: soqlUserQuery});
		userDescription.name = JSON.parse(soqlUserResult.content[0].text)[0].Name;
	}, 100);

} catch (error) {
	log('Error starting IBM MCP Salesforce server:', error);
	process.exit(1);
}