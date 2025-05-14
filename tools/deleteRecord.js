/*globals process */
import {runCliCommand} from './utils.js';

async function deleteRecord({sObjectName, recordId}) {
	try {
		const command = `sf data delete record --sobject ${sObjectName} --record-id ${recordId} -o ${process.env.username} --json`;
		console.error(`Executing command: ${command}`);
		const response = await runCliCommand(command);
		if (response.status !== 0) {
			throw new Error(`Failed to delete record: ${response.result.errors[0].message}`);
		} else {
			return {
				content: [{
					type: 'text',
					text: `✅ Record deleted successfully with id ${response.result.id}`
				}]
			};
		}
	} catch (error) {
		console.error(`Error deleting ${sObjectName} record ${recordId}:`, JSON.stringify(error, null, 2));
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export {deleteRecord};