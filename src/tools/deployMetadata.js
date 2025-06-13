import {getOrgDescription} from '../../index.js';
import {runCliCommand, log} from '../utils.js';

async function deployMetadata({sourceDir}) { //, context
	try {
		const command = `sf project deploy start --source-dir ${sourceDir} --ignore-conflicts -o "${getOrgDescription().alias}" --json`;
		log(`Executing deploy command: ${command}`);
		const response = JSON.parse(await runCliCommand(command));
		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(response.result, null, '\t')
				}
			]
		};
	} catch (error) {
		log(`Error deploying metadata file ${sourceDir}: ${JSON.stringify(error, null, 2)}`);
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

export default deployMetadata;