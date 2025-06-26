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

		const structuredContent = {
			id: recordId,
			sObject: sObjectName,
			fields: fieldsObject
		};
		return {
			content: [{
				type: 'text',
				text: JSON.stringify(structuredContent)
			}],
			structuredContent
		};
	} catch (error) {
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

export default updateRecord;