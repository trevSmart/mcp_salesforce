import state from '../state.js';
import {log, loadToolDescription} from '../utils.js';
import {callSalesforceApi} from '../salesforceServices/callSalesforceApi.js';
import crypto from 'crypto';
import {getOrgAndUserDetails} from '../salesforceServices/getOrgAndUserDetails.js';

let currentSessionId = null;

export const chatWithAgentforceToolDefinition = {
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

async function startSession() {
	try {
		log('Starting Agentforce session...');

		await getOrgAndUserDetails();

		const body = {
			externalSessionKey: crypto.randomUUID(),
			instanceConfig: {
				endpoint: state.org.instanceUrl
			},
			tz: 'America/Los_Angeles',
			variables: [
				{
					name: '$Context.EndUserLanguage',
					type: 'Text',
					value: 'en_US'
				}
			],
			featureSupport: 'Streaming',
			streamingCapabilities: {
				chunkTypes: [
					'Text'
				]
			},
			bypassUser: true
		};

		const response = await callSalesforceApi(
			'POST',
			'https://api.salesforce.com/einstein/ai-agent/v1',
			`/agents/${process.env.SF_MCP_AGENTFORCE_AGENT_ID}/sessions`,
			body
		);



		if (!response || !response.sessionId) {
			throw new Error('Invalid response from Agentforce API: missing sessionId');
		}

		currentSessionId = response.sessionId;
		log('Session started with id:', currentSessionId);
		return response;
	} catch (error) {
		log('Error starting session:', error);
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

async function sendMessage(message) {
	if (!currentSessionId) {
		await startSession();
	}

	try {
		const response = await callSalesforceApi(
			'POST',
			'https://api.salesforce.com/einstein/ai-agent/v1',
			`/sessions/${currentSessionId}/messages`,
			{
				message: {
					sequenceId: new Date().getTime(),
					type: 'Text',
					text: message
				},
				variables: []
			}
		);

		if (!response) {
			throw new Error('Empty response from Agentforce API');
		}

		return response;
	} catch (error) {
		log('Error sending message:', error);
		log('Error sending message:', JSON.stringify(error, null, 2));
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export async function chatWithAgentforce({message}) {
	if (!message) {
		return {
			isError: true,
			content: [{
				type: 'text',
				text: 'Error de validación, es obligatorio indicar un valor de message'
			}]
		};
	}

	if (!process.env.SF_MCP_AGENTFORCE_AGENT_ID) {
		throw new Error('Missing agentforceAgentId environment variable');
	}

	try {
		const response = await sendMessage(message);
		return {
			content: [{
				type: 'text',
				text: response.messages?.[0].message || 'No response received from Agentforce'
			}],
			data: response,
			structuredContent: response
		};
	} catch (error) {
		log('Error sending message:', error);
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}