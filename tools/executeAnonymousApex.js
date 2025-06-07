import {getOrgDescription} from '../index.js';
import {promisify} from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {runCliCommand} from '../src/utils.js';

const writeFilePromise = promisify(fs.writeFile);
const unlinkPromise = promisify(fs.unlink);

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

//eslint-disable-next-line no-unused-vars
async function executeAnonymousApex({apexCode}) { //, context
	let tempFilePath;
	try {
		//Create temporary file
		tempFilePath = path.join(os.tmpdir(), `apex-${Date.now()}.apex`);
		const formattedCode = formatApexCode(apexCode);
		await writeFilePromise(tempFilePath, formattedCode);

		//Execute SF CLI command
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
		//Delete the temporary file if it exists
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