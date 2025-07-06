import {log} from '../utils.js';
import {runCliCommand} from './runCliCommand.js';

/**
 * Deploys Salesforce metadata from a local directory or file
 * @param {Object} params
 * @param {string} params.sourceDir - Path to the local metadata file or directory
 * @returns {Promise<Object>} - Deploy result
 */
export async function deployMetadata({sourceDir}) {
	try {
		const command = `sf project deploy start --source-dir ${sourceDir} --ignore-conflicts --json`;
		log(`Executing deploy command: ${command}`);
		const response = JSON.parse(await runCliCommand(command));
		return response.result;
	} catch (error) {
		log(`Error deploying metadata file ${sourceDir}: ${JSON.stringify(error, null, 2)}`);
		throw error;
	}
}