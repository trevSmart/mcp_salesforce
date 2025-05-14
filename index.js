/*globals process */
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema, CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
//const {z} = require('zod');

import {initServer} from './tools/utils.js';

//Tools
import {createRecord} from './tools/createRecord.js';
import {deleteRecord} from './tools/deleteRecord.js';
import {deployMetadata} from './tools/deployMetadata.js';
import {describeObject} from './tools/describeObject.js';
import {executeAnonymousApex} from './tools/executeAnonymousApex.js';
import {getRecentlyViewedRecords} from './tools/getRecentlyViewedRecords.js';
import {getRecord} from './tools/getRecord.js';
import {getSetupAuditTrail} from './tools/getSetupAuditTrail.js';
import {getUserId} from './tools/getUserId.js';
import {setDebugLogLevels} from './tools/setDebugLogLevels.js';
import {soqlQuery} from './tools/soqlQuery.js';
import {toolingApiRequest} from './tools/toolingApiRequest.js';
import {updateRecord} from './tools/updateRecord.js';
import {triggerExecutionOrder} from './tools/triggerExecutionOrder.js';
import {metadataApiRequest} from './tools/metadataApiRequest.js';
import {chatWithAgentforce} from './tools/chatWithAgentforce.js';

let orgDescription;
let currentUser;

export function getOrgDescription() {
	return orgDescription;
}

export function getCurrentAccessToken() {
	return orgDescription.accessToken;
}

export function setCurrentAccessToken(accessToken) {
	orgDescription.accessToken = accessToken;
}

//Definició dels tools
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
	description: 'This tool allows retrieving a list of configuration actions performed in Salesforce.',
	inputSchema: {
		type: 'object',
		required: ['lastDays'],
		properties: {
			lastDays: {
				type: 'number',
				description: 'Number of days to query (between 1 and 365)',
			},
			createdByName: {
				type: 'string',
				description: 'User name to filter',
			},
			metadataName: {
				type: 'string',
				description: 'Metadata filter',
			},
		},
	},
	annotations: {
		title: 'Get Setup Audit Trail data',
		readOnlyHint: true,
		openWorldHint: true
	}
};

const getUserIdTool = {
	name: 'getUserId',
	description: 'This tool allows finding a user ID by name or username in Salesforce.',
	inputSchema: {
		type: 'object',
		required: ['searchTerm', 'searchType'],
		properties: {
			searchTerm: {
				type: 'string',
				description: 'The name or username to search for (default: current user)'
			},
			searchType: {
				type: 'string',
				description: 'Type of search: "name", "username", or "both" (default)',
				enum: ['name', 'username', 'both']
			}
		}
	},
	annotations: {
		title: 'Get User ID',
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: true
	}
};

const setDebugLogLevelsTool = {
	name: 'setDebugLogLevels',
	description: 'This tool allows setting the debug log levels in Salesforce.',
	inputSchema: {
		type: 'object',
		required: ['userId', 'active'],
		properties: {
			userId: {
				type: 'string',
				description: 'The user ID to set the debug log levels for'
			},
			active: {
				type: 'boolean',
				description: 'Whether to activate or deactivate the debug log levels'
			}
		}
	},
	annotations: {
		title: 'Set Debug Log Levels',
		readOnlyHint: false,
		openWorldHint: true
	}
};

const soqlQueryTool = {
	name: 'soqlQuery',
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
				description: 'The DML operation (insert, update, or delete)',
				enum: ['insert', 'update', 'delete']
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

const server = new Server(
	{
		name: 'salesforce-mcp',
		version: '1.0.0',
	},
	{
		capabilities: {
			logging: {},
			tools: {
				"listChanged": true,
				createRecordTool,
				deleteRecordTool,
				deployMetadataTool,
				describeObjectTool,
				executeAnonymousApexTool,
				getRecentlyViewedRecordsTool,
				getRecordTool,
				getSetupAuditTrailTool,
				getUserIdTool,
				setDebugLogLevelsTool,
				soqlQueryTool,
				toolingApiRequestTool,
				updateRecordTool,
				triggerExecutionOrderTool,
				metadataApiRequestTool,
				chatWithAgentforceTool
			},
		},
	}
);


server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: [
		createRecordTool,
		deleteRecordTool,
		deployMetadataTool,
		describeObjectTool,
		executeAnonymousApexTool,
		getRecentlyViewedRecordsTool,
		getRecordTool,
		getSetupAuditTrailTool,
		getUserIdTool,
		setDebugLogLevelsTool,
		soqlQueryTool,
		toolingApiRequestTool,
		updateRecordTool,
		triggerExecutionOrderTool,
		metadataApiRequestTool,
		chatWithAgentforceTool
	]
}));

server.setRequestHandler(CallToolRequestSchema, async request => {
	const {name, arguments: args, _meta = {}} = request.params;

	try {
		let result;
		console.error('Executing tool:', name);
		console.error('Args:', args);
		console.error('Meta:', _meta);
		if (name === 'createRecord') {
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
		} else if (name === 'getUserId') {
			result = await getUserId(args, _meta);
		} else if (name === 'setDebugLogLevels') {
			result = await setDebugLogLevels(args, _meta);
		} else if (name === 'soqlQuery') {
			result = await soqlQuery(args, _meta);
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
		} else {
			throw new Error(`Unknown tool: ${name}`);
		}

		//Si la tool ja retorna un objecte amb el format correcte, el retornem directament
		if (result && result.content) {
			return result;
		}
	} catch (error) {
		console.error(`Error executing ${name}:`, error);
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error executing ${name}: ${error.message}`
			}]
		};
	}
});

const transport = new StdioServerTransport();
try {
	await server.connect(transport);
	console.error('IBM MCP Salesforce server started successfully');
	setTimeout(async () => {
		orgDescription = await initServer();
		currentUser = await getUserId({searchTerm: orgDescription.user, searchType: 'name'});
	}, 1000);
} catch (error) {
	console.error('Error starting IBM MCP Salesforce server:', error);
	process.exit(1);
}