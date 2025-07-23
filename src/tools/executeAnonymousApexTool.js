import state from '../state.js';
import {log, textFileContent, getTimestamp} from '../utils.js';
import {executeAnonymousApex} from '../salesforceServices.js';
import {mcpServer, sendElicitRequest, newResource} from '../mcp-server.js';
import client from '../client.js';
import {z} from 'zod';
import fs from 'fs/promises';
import path from 'path';

export const executeAnonymousApexToolDefinition = {
	name: 'executeAnonymousApex',
	title: 'Execute Anonymous Apex',
	description: textFileContent('executeAnonymousApexTool'),
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
	} catch (e) {
		//If not JSON, return the code as is
		return code;
	}
}

export async function executeAnonymousApexTool({apexCode, mayModify}) {
	try {
		if (mayModify && client.supportsCapability('elicitation')) {
			const elicitResult = await sendElicitRequest({
				confirmation: {
					type: 'string',
					title: 'Execute anonymous apex confirmation',
					description: `Are you sure you want to run this anonymous Apex code in ${state.org.alias}?`,
					enum: ['Yes', 'No'],
					enumNames: ['✅ Execute anonymous Apex code', '❌ Don\'t execute']
				}
			});
			if (elicitResult.action !== 'accept' || elicitResult.content?.confirmation !== 'Yes') {
				return {
					content: [{type: 'text', text: 'Script execution cancelled by user'}]
				};
			}
		}

		const formattedCode = formatApexCode(apexCode);
		const result = await executeAnonymousApex(formattedCode);

		const content = [{
			type: 'text',
			text: `Resultat execució Anonymous Apex:\n\n${JSON.stringify(result.logs)}`
		}];

		const tmpDir = path.join(state.workspacePath, 'tmp');
		//Use the same naming format as the main execution
		const username = state.org?.user?.name || 'unknown';

		const logFileName = `ApexRun_${getTimestamp()}.log`;
		await fs.mkdir(tmpDir, {recursive: true});
		await fs.writeFile(path.join(tmpDir, logFileName), result.logs, 'utf8');
		const logSize = (Buffer.byteLength(result.logs, 'utf8') / 1024).toFixed(1);
		if (client.isVsCode && result?.logs) {
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
		mcpServer.server.sendResourceListChanged();
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