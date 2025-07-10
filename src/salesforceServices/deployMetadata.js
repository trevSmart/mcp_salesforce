import {log} from '../utils.js';
import {runCliCommand} from './runCliCommand.js';

/**
 * Deploys Salesforce metadata from a local directory or file
 * @param {Object} params
 * @param {string} params.sourceDir - Path to the local metadata file or directory
 * @returns {Promise<Object>} - Deploy result
 */
export async function deployMetadata(sourceDir) {
	try {
		const command = `sf project deploy start --source-dir "${sourceDir}" --ignore-conflicts --json`;
		const response = JSON.parse(await runCliCommand(command));

		if (response.status !== 0 || (response.exitCode ?? 0) !== 0) {
			throw new Error(JSON.stringify(response));
		}
		return response;

	} catch (error) {
		log(`Error deploying metadata file ${sourceDir}: ${error}`, 'error');
		throw error;
	}
}