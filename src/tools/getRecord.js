import {salesforceState} from '../state.js';
import {runCliCommand, log} from '../utils.js';

async function getRecord({sObjectName, recordId}) {
	try {
		const command = `sf data get record --sobject ${sObjectName} --record-id ${recordId} -o "${salesforceState.orgDescription.alias}" --json`;
		log(`Executing get record command: ${command}`);
		const response = await JSON.parse(await runCliCommand(command));
		//const {attributes, ...fields} = response.result;
		const structuredContent = {
			id: recordId,
			sObject: sObjectName,
			fields: response
		};
		return {
			content: [{
				type: 'text',
				text: JSON.stringify(structuredContent)
			}],
			structuredContent
		};
	} catch (error) {
		log(`Error getting record ${recordId} from object ${sObjectName}:`, JSON.stringify(error, null, 2));
		const errorContent = {error: true, message: error.message};
		return {
			isError: true,
			content: [{
				type: 'text',
				text: JSON.stringify(errorContent)
			}],
			structuredContent: errorContent
		};
	}
}

export default getRecord;