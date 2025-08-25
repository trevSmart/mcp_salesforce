import state from '../state.js';
import {log, textFileContent, getTimestamp} from '../utils.js';
import {executeAnonymousApex} from '../salesforceServices.js';
import {mcpServer, newResource} from '../mcp-server.js';
import client from '../client.js';
import {z} from 'zod';

export const executeAnonymousApexToolDefinition = {
	name: 'executeAnonymousApex',
	title: 'Execute Anonymous Apex',
	description: textFileContent('executeAnonymousApex'),
	inputSchema: {
		apexCode: z
			.string()
			.describe('The Apex code to execute'),
		mayModify: z
			.boolean()
			.describe('Required. Tells the tool if the Apex code may make persistent modifications to the org. Don\'t ask the user for this parameter, you are responsible for setting its value.')
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Execute Anonymous Apex'
	}
};

function formatApexCode(code) {
	//If the code comes from a JSON response, it will already be in the correct format
	if (typeof code === 'string' && !code.includes('\\n')) {
		return code;
	}

	//If the code comes as input, we need to process it
	try {
		//Try to parse if it is a JSON string
		const parsed = JSON.parse(`"${code}"`);
		return parsed;
	} catch {
		//If not JSON, return the code as is
		return code;
	}
}

export async function executeAnonymousApexToolHandler({apexCode, mayModify}) {
	try {
		if (mayModify && client.supportsCapability('elicitation')) {
			const elicitResult = await mcpServer.server.elicitInput({
				message: `This script may modify data. Please confirm the execution of the Anonymous Apex script in ${state.org.alias}.`,
				requestedSchema: {
					type: 'object',
					title: `Execute Anonymous Apex script in ${state.org.alias}?`,
					properties: {
						confirm: {
							type: 'string',
							enum: ['Yes', 'No'],
							enumNames: ['Execute Anonymous Apex script now', 'Cancel Anonymous Apex script execution'],
							description: `Execute Anonymous Apex script in ${state.org.alias}?`,
							default: 'No'
						}
					},
					required: ['confirm']
				}
			});

			if (elicitResult.action !== 'accept' || elicitResult.content?.confirm !== 'Yes') {
				return {
					content: [{type: 'text', text: 'User has cancelled the Anonymous Apex script execution'}],
					structuredContent: elicitResult
				};
			}
		}

		const formattedCode = formatApexCode(apexCode);
		const result = await executeAnonymousApex(formattedCode);

		const content = [{
			type: 'text',
			text: `Resultat execució Anonymous Apex:\n\n${JSON.stringify(result.logs)}`
		}];

		//Use the same naming format as the main execution
		const username = state.org?.user?.name || 'unknown';

		// const logPath = await writeToTmpFileAsync(result.logs, 'ApexRun', 'log', 'utf8', state.workspacePath);
		const logSize = (Buffer.byteLength(result.logs, 'utf8') / 1024).toFixed(1);

		if (client.supportsCapability('embeddedResources') && result?.logs) {
			const logFileName = `apex_run_${getTimestamp(true)}.log`;
			const resourceApexLog = newResource(
				`file://apex/${logFileName}`,
				logFileName,
				`${getTimestamp(true)} - ${username} - ${logSize}KB`,
				'text/plain',
				result.logs,
				{audience: ['user', 'assistant']}
			);
			content.push({type: 'resource', resource: resourceApexLog});
		}

		return {content, structuredContent: result};

	} catch (error) {
		log(error, 'error');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `Error: ${error.message}`
			}]
		};
	}
}