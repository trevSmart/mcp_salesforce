import {runCliCommand} from '../utils.js';

async function metadataApiRequest({metadataType, targetUsername}) {
	try {
		const command = ['force:source:retrieve'];

		//Add the metadata type
		command.push('-m', metadataType);

		//If a username is specified, add it
		if (targetUsername) {
			command.push('-u', targetUsername);
		}

		//Execute the command
		const result = await JSON.parse(await runCliCommand(command.join(' ')));

		return {
			success: true,
			data: result,
			structuredContent: result
		};
	} catch (error) {
		throw new Error(`Error retrieving metadata: ${error.message}`);
	}
}

export default metadataApiRequest;