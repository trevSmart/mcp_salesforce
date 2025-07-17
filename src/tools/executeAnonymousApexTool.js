import state from '../state.js';
import {log, loadToolDescription, setResource, sendElicitRequest} from '../utils.js';
import {executeAnonymousApex} from '../salesforceServices/executeAnonymousApex.js';
import {resourceLimits} from 'worker_threads';

export const executeAnonymousApexToolDefinition = {
	name: 'executeAnonymousApex',
	title: 'Execute Anonymous Apex',
	description: loadToolDescription('executeAnonymousApexTool'),
	inputSchema: {
		type: 'object',
		required: ['apexCode', 'mayModify'],
		properties: {
			apexCode: {
				type: 'string',
				description: 'The Apex code to execute'
			},
			mayModify: {
				type: 'boolean',
				description: 'Required. Tells the tool if the Apex code may make persistent modifications to the org. Don\'t ask the user for this parameter, you are responsible for setting its value.',
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
		if (!apexCode || typeof mayModify !== 'boolean') {
			throw new Error('apexCode and mayModify are required inputs');
		}

		if (mayModify && state.client.capabilities?.elicitation) {
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

		if (state.client.clientInfo.isVscode && result?.logs) {
			const tmpDir = state.workspacePath + '/tmp';
			const logFileName = `anonymousApex_${Date.now()}.log`;
			await fs.mkdir(tmpDir, {recursive: true});
			await fs.writeFile(path.join(tmpDir, logFileName), result.logs, 'utf8');

			content.push({type: 'resource', resource: setResource(`file://apex/${logFileName}`, 'text/plain', result.logs)});
		}

		log('!!!!content', 'emergency');
		log({content, structuredContent: result}, 'emergency');
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