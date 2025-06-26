import {salesforceState} from '../state.js';
import {promisify} from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {runCliCommand, log} from '../utils.js';

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
		const command = `sf apex run -o "${salesforceState.orgDescription.alias}" --file "${tempFilePath}" --json`;
		const response = await runCliCommand(command, {log: true});
		const structuredContent = {
			result: response.result
		};
		return {
			content: [{
				type: 'text',
				text: JSON.stringify(structuredContent)
			}],
			structuredContent
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
	} finally {
		//Delete the temporary file if it exists
		if (tempFilePath) {
			try {
				await unlinkPromise(tempFilePath);
			} catch (error) {
				log(`Error deleting temporary file: ${error.message}`);
			}
		}
	}
}

export default executeAnonymousApex;