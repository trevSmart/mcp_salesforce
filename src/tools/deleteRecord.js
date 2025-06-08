import {getOrgDescription} from '../../index.js';
import {runCliCommand, log} from '../utils.js';

async function deleteRecord({sObjectName, recordId}) {
	try {
		const command = `sf data delete record --sobject ${sObjectName} --record-id ${recordId} -o ${getOrgDescription().alias} --json`;
		const response = JSON.parse(await runCliCommand(command));
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