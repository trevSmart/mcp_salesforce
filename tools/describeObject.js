import {getOrgDescription} from '../index.js';
import {runCliCommand} from './utils.js';

async function describeObject({sObjectName}) {
	try {
		//Validate object name
		if (!sObjectName || typeof sObjectName !== 'string') {
			throw new Error('SObject name must be a non-empty string');
		}

		const command = `sf sobject describe --sobject ${sObjectName} -o ${getOrgDescription().alias} --json`;
		console.error(`Executing describe command: ${command}`);
		const response = await runCliCommand(command);
		return {
			content: [{
				type: 'text',
				text: `✅ SObject ${sObjectName} described successfully: ${JSON.stringify(response, null, '\t')}`
			}]
		};

	} catch (error) {
		console.error(`Error describing SObject ${sObjectName}:`, JSON.stringify(error, null, 2));
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export {describeObject};