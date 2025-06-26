import {salesforceState} from '../state.js';
import {runCliCommand, log} from '../utils.js';

async function deleteRecord({sObjectName, recordId}) {
	try {
		log(`Executing delete record command: ${sObjectName} ${recordId}`);
		const command = `sf data delete record --sobject ${sObjectName} --record-id ${recordId} -o "${salesforceState.orgDescription.alias}" --json`;
		const response = await runCliCommand(command);

		log(`Tool response: ${response}`, 'debug');
		if (response.status !== 0) {
			const errorContent = {error: true, message: response.message};
			return {
				isError: true,
				content: [{
					type: 'text',
					text: JSON.stringify(errorContent)
				}],
				structuredContent: errorContent
			};
		} else {
			const structuredContent = {
				id: recordId,
				sObject: sObjectName
			};
			return {
				content: [{
					type: 'text',
					text: JSON.stringify(structuredContent)
				}],
				structuredContent
			};
		}
	} catch (error) {
		log(`Error deleting ${sObjectName} record ${recordId}:`, JSON.stringify(error, null, 2));
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

export default deleteRecord;