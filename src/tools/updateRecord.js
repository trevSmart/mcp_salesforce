import {salesforceState} from '../state.js';
import {runCliCommand} from '../utils.js';
import pkg from 'lodash';
const {escape} = pkg;

async function updateRecord({sObjectName, recordId, fields}) {
	try {
		//Use fields directly if already an object, otherwise try to parse them
		const fieldsObject = typeof fields === 'string' ? JSON.parse(fields) : fields;

		//Convert fields to format "Field1='Value1' Field2='Value2'"
		const valuesString = Object.entries(fieldsObject)
			.map(([key, value]) => `${key}='${escape(value)}'`)
			.join(' ');

		//Execute the CLI command
		const command = `sf data update record --sobject ${sObjectName} --where "Id='${recordId}'" --values "${valuesString}" -o "${salesforceState.orgDescription.alias}" --json`;
		const response = await runCliCommand(command);

		log(`Tool response: ${response}`, 'debug');

		return {
			content: [
				{
					type: 'text',
					text: `Record ${recordId} from object ${sObjectName} updated successfully`
				}
			]
		};
	} catch (error) {
		return {
			content: [
				{
					type: 'text',
					text: `Error updating record ${recordId} from object ${sObjectName}: ${error.message}`
				}
			]
		};
	}
}

export default updateRecord;