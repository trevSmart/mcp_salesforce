import {runCliCommand} from '../utils.js';

async function metadataApiRequest({metadataType, targetUsername}) {
	try {
		const command = ['force:source:retrieve'];

		//Afegim el tipus de metadada
		command.push('-m', metadataType);

		//If a username is specified, add it
		if (targetUsername) {
			command.push('-u', targetUsername);
		}

		//Executem la comanda
		const result = await JSON.parse(await runCliCommand(command.join(' ')));

		return {
			success: true,
			data: result
		};
	} catch (error) {
		throw new Error(`Error retrieving metadata: ${error.message}`);
	}
}

export default metadataApiRequest;