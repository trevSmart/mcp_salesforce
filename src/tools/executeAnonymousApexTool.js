import state from '../state.js';
import {log, textFileContent} from '../utils.js';
import {executeAnonymousApex} from '../salesforceServices.js';
import {sendElicitRequest, newResource} from '../mcp-server.js';
import client from '../client.js';
import {z} from 'zod';

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

		//Create a temporary file with the content of result.logs
		const fs = await import('fs/promises');
		const path = await import('path');

		const content = [{
			type: 'text',
			text: `Resultat execució Anonymous Apex:\n\n${JSON.stringify(result, null, 2)}`
		}];

		if (client.isVscode && result?.logs) {
			const tmpDir = state.workspacePath + '/tmp';
			const logFileName = `anonymousApex_${Date.now()}.log`;
			await fs.mkdir(tmpDir, {recursive: true});
			await fs.writeFile(path.join(tmpDir, logFileName), result.logs, 'utf8');

			const resourceApexLog = newResource(
				`file://apex/${logFileName}`,
				'text/plain',
				result.logs,
				{audience: ['user', 'assistant'], lastModified: new Date().toISOString()}
			);
			content.push({type: 'resource', resource: resourceApexLog});
		}

		return {content, structuredContent: result};

	} catch (error) {
		log(error, 'error');
		const errorContent = {error: true, message: error.message};
		return {
			isError: true,
			content: [{
				type: 'text',
				text: JSON.stringify(errorContent)
			}],
			structuredContent: errorContent
		};
	}
}