import {getOrgDescription} from '../../index.js';
import {runCliCommand, log} from '../utils.js';

async function createRecord({sObjectName, fields}) {
	try {
		//Ensure fields is a proper object
		let fieldsObject;
		if (typeof fields === 'string') {
			fieldsObject = JSON.parse(fields);
		} else if (typeof fields === 'object' && fields !== null) {
			fieldsObject = fields;
		} else {
			throw new Error('Field values must be a valid object or JSON string');
		}

		//Validate object name
		if (!sObjectName || typeof sObjectName !== 'string') {
			throw new Error('SObject name must be a non-empty string');
		}

		//Convert fields object to CLI format with proper escaping
		const valuesString = Object.entries(fieldsObject)
			.map(([key, value]) => {
				//Escape single quotes in values
				const escapedValue = String(value).replace(/'/g, '\\\'');
				return `${key}='${escapedValue}'`;
			}).join(' ');

		//Execute sf CLI command
		const command = `sf data create record --sobject ${sObjectName} --values "${valuesString}" -o ${getOrgDescription().alias} --json`;
		log(`Executing create record command: ${command}`);
		const response = JSON.parse(await runCliCommand(cowmmand));

		if (response.status !== 0) {
			throw new Error(`Failed to create record: ${response.result.errors[0].message}`);
		} else {
			const recordId = response.result.id;
			const recordUrl = `https://${getOrgDescription().instanceUrl}/${recordId}`;
			return {
				content: [{
					type: 'text',
					text: `✅ Record created successfully with id "${recordId}".\n🔗 [View record in Salesforce](${recordUrl})`
				}]
			};
		}
	} catch (error) {
		log(`Error creating ${sObjectName} record:`, JSON.stringify(error, null, 2));
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export default createRecord;