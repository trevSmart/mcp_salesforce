import {getOrgDescription} from '../index.js';
import {promisify} from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {runCliCommand} from './utils.js';

const writeFilePromise = promisify(fs.writeFile);
const unlinkPromise = promisify(fs.unlink);

function formatApexCode(code) {
	//Si el codi ve d'una resposta JSON, ja estarà en format correcte
	if (typeof code === 'string' && !code.includes('\\n')) {
		return code;
	}

	//Si el codi ve com a entrada, necessitem processar-lo
	try {
		//Intentem fer parse si és un string JSON
		const parsed = JSON.parse(`"${code}"`);
		return parsed;
	} catch (e) {
		//Si no és JSON, retornem el codi tal qual
		return code;
	}
}

//eslint-disable-next-line no-unused-vars
async function executeAnonymousApex({apexCode}) { //, context
	let tempFilePath;
	try {
		//Crear fitxer temporal
		tempFilePath = path.join(os.tmpdir(), `apex-${Date.now()}.apex`);
		const formattedCode = formatApexCode(apexCode);
		await writeFilePromise(tempFilePath, formattedCode);

		//Executar comanda SF CLI
		const command = `sf apex run -o ${getOrgDescription().alias} --file "${tempFilePath}" --json`;
		console.error(`Executing command: ${command}`);
		const response = await runCliCommand(command);
		console.error(response);
		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(response.result, null, '\t')
				}
			]
		};

	} catch (error) {
		console.error(error);
		return {
			isError: true,
			content: [
				{
					type: 'text',
					text: JSON.stringify(error, null, '\t')
				}
			]
		};
	} finally {
		//Esborrar el fitxer temporal si existeix
		if (tempFilePath) {
			try {
				await unlinkPromise(tempFilePath);
			} catch (error) {
				console.error(`Error esborrant el fitxer temporal: ${error.message}`);
			}
		}
	}
}

export {executeAnonymousApex};