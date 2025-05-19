import {getOrgDescription} from '../index.js';
import {runCliCommand} from './utils.js';

async function deployMetadata({sourceDir}) { //, context
	try {
		const command = `sf project deploy start --source-dir ${sourceDir} --ignore-conflicts -o ${getOrgDescription().alias} --json`;
		console.error(`Executing deploy command: ${command}`);
		const response = await runCliCommand(command);
		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(response.result, null, '\t')
				}
			]
		};
	} catch (error) {
		console.error(`Error deploying metadata file ${sourceDir}: ${JSON.stringify(error, null, 2)}`);
		return {
			isError: true,
			content: [
				{
					type: 'text',
					text: JSON.stringify(error, null, '\t')
				}
			]
		};
	}
}

export {deployMetadata};