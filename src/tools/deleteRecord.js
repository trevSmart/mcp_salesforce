import {salesforceState} from '../state.js';
import {runCliCommand, log} from '../utils.js';

async function deleteRecord({sObjectName, recordId}) {
	try {
		log(`Executing delete record command: ${sObjectName} ${recordId}`);
		const command = `sf data delete record --sobject ${sObjectName} --record-id ${recordId} -o "${salesforceState.orgDescription.alias}" --json`;
		const response = await runCliCommand(command);

		log(`Tool response: ${response}`, 'debug');
		if (response.status !== 0) {
			throw new Error(response.message);
		} else {
			return {
				content: [{
					type: 'text',
					text: `✅ Record deleted successfully with id ${response.result.id}`
				}]
			};
		}
	} catch (error) {
		log(`Error deleting ${sObjectName} record ${recordId}:`, JSON.stringify(error, null, 2));
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error deleting ${sObjectName} record with id ${recordId}: ${error.message}`
			}]
		};
	}
}

export default deleteRecord;