import {getOrgDescription} from '../../index.js';
import {callSalesforceAPI, log} from '../utils.js';
import crypto from 'crypto';

let currentSessionId = null;

async function startSession() {
	try {
		log('Starting Agentforce session...');

		const body = {
			externalSessionKey: crypto.randomUUID(),
			instanceConfig: {
				endpoint: getOrgDescription().instanceUrl
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

		const response = await callSalesforceAPI(
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
		const response = await callSalesforceAPI(
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

async function chatWithAgentforce({message}) {
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
			data: response
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

export default chatWithAgentforce;