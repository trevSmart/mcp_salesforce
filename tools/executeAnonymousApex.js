/*globals process */
import {promisify} from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {runCliCommand} from './utils.js';

const execPromise = promisify(exec);
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
		const command = `sf apex run -o ${process.env.username} --file "${tempFilePath}" --json`;
		console.error(`Executing command: ${command}`);
		const response = await runCliCommand(command);
		console.error(response);
		return {...response.result, apexCode: formattedCode};

	} catch (error) {
		return {
			success: false,
			apexCode: apexCode,
			compiled: '',
			compileProblem: '',
			exceptionMessage: '',
			exceptionStackTrace: '',
			line: -1,
			column: -1,
			logs: JSON.stringify(error, null, 2)
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