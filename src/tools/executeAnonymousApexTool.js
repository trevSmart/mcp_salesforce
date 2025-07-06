import {log, loadToolDescription} from '../utils.js';
import {apexCodeSchema} from './paramSchemas.js';
import {z} from 'zod';
import {executeAnonymousApex} from '../salesforceServices/executeAnonymousApex.js';

export const executeAnonymousApexToolDefinition = {
	name: 'executeAnonymousApex',
	title: 'Execute Anonymous Apex',
	description: loadToolDescription('executeAnonymousApexTool'),
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

export async function executeAnonymousApexTool(params) {
	const schema = z.object({
		apexCode: apexCodeSchema,
	});
	const parseResult = schema.safeParse(params);
	if (!parseResult.success) {
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error de validació: ${parseResult.error.message}`
			}]
		};
	}
	try {
		const formattedCode = formatApexCode(params.apexCode);
		const result = await executeAnonymousApex(formattedCode);
		return {
			content: [
				{
					type: 'text',
					text: `Resultat execució Anonymous Apex:\n\n${JSON.stringify(result, null, 2)}`
				}
			],
			structuredContent: result
		};
	} catch (error) {
		log(error);
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