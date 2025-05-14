/*globals process */
import {runCliCommand} from './utils.js';

async function deployMetadata({sourceDir}) { //, context
	try {
		const command = `sf project deploy start --source-dir ${sourceDir} --ignore-conflicts -o ${process.env.username} --json`;
		console.error(`Executing deploy command: ${command}`);
		const response = await runCliCommand(command);
		return response.result;

	} catch (error) {
		console.error(`Error deploying metadata file ${sourceDir}: ${JSON.stringify(error, null, 2)}`);
		return {
			success: false,
			compiled: '',
			compileProblem: '',
			exceptionMessage: error.message,
			exceptionStackTrace: error.stack || '',
			line: -1,
			column: -1,
			logs: error.message
		};
	}
}

export {deployMetadata};