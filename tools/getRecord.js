/*globals require, module, process */
import { getOrgDescription } from '../index.js';
import {runCliCommand} from './utils.js';

async function getRecord({sObjectName, recordId}) {
	try {
		const command = `sf data get record --sobject ${sObjectName} --record-id ${recordId} -o ${getOrgDescription().alias} --json`;
		console.error(`Executing get record command: ${command}`);
		const response = await runCliCommand(command);
		const {attributes, ...fields} = response.result;
		return {
			content: [{
				type: 'text',
				text: `✅ Record ${recordId} from object ${sObjectName} retrieved successfully: ${JSON.stringify(response, null, '\t')}`
			}]
		};
	} catch (error) {
		console.error(`Error getting record ${recordId} from object ${sObjectName}:`, JSON.stringify(error, null, 2));
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export { getRecord };