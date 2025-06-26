import {salesforceState} from '../state.js';
import {runCliCommand, log, notifyProgressChange} from '../utils.js';

async function dmlOperation({operation, sObjectName, recordId, fields = {}}, {progressToken}) {
	let command;
	let successMessage;

	try {
		if (!sObjectName || typeof sObjectName !== 'string') {
		//Validate sObjectName
			throw new Error('SObject name must be a non-empty string');
		}

		//Prepare command based on operation
		switch (operation) {
			case 'create': {
				notifyProgressChange(progressToken, 1, 1, 'Executing DML operation (create)');

				const fieldsObject = typeof fields === 'string' ? JSON.parse(fields) : fields;
				if (!fieldsObject || typeof fieldsObject !== 'object') {
					throw new Error('Field values must be a valid object or JSON string');
				}

				const valuesString = Object.entries(fieldsObject).map(([key, value]) => {
					const escapedValue = String(value).replace(/'/g, '\\\'');
					return `${key}='${escapedValue}'`;
				}).join(' ');

				command = `sf data create record --sobject ${sObjectName} --values "${valuesString}" -o "${salesforceState.orgDescription.alias}" --json`;
				break;
			}

			case 'update': {
				notifyProgressChange(progressToken, 2, 2, 'Executing DML operation (update)');

				if (!recordId) {throw new Error('Record ID is required for update operation')}
				const fieldsObject = typeof fields === 'string' ? JSON.parse(fields) : fields;
				if (!fieldsObject || typeof fieldsObject !== 'object') {
					throw new Error('Field values must be a valid object or JSON string');
				}
				const valuesString = Object.entries(fieldsObject)
					.map(([key, value]) => `${key}='${String(value).replace(/'/g, '\\\'')}'`)
					.join(' ');
				command = `sf data update record --sobject ${sObjectName} --record-id ${recordId} --values "${valuesString}" -o "${salesforceState.orgDescription.alias}" --json`;
				break;
			}

			case 'delete': {
				notifyProgressChange(progressToken, 3, 3, 'Executing DML operation (delete)');

				if (!recordId) {throw new Error('Record ID is required for delete operation')}
				command = `sf data delete record --sobject ${sObjectName} --record-id ${recordId} -o "${salesforceState.orgDescription.alias}" --json`;
				break;
			}

			default:
				throw new Error(`Invalid operation: "${operation}". Must be "create", "update", or "delete".`);
		}

		//Execute command
		log(`Executing DML operation: ${command}`);
		const rawResponse = await runCliCommand(command);
		log(`DML operation result: ${rawResponse}`, 'debug');

		const response = JSON.parse(rawResponse);

		if (response.status !== 0) {
			log(`Parsed error response: ${JSON.stringify(response, null, 2)}`);
			const errorMessage = response.result?.errors?.[0]?.message || response.message || 'An unknown error occurred.';
			throw new Error(`Failed to ${operation} record: ${errorMessage}`);
		}

		//Handle success response
		const result = response.result;
		switch (operation) {
			case 'create': {
				const newRecordId = result.id || result.Id;
				const recordUrl = `https://${salesforceState.orgDescription.instanceUrl}/${newRecordId}`;
				successMessage = `✅ Record created successfully with id "${newRecordId}".\n🔗 [View record in Salesforce](${recordUrl})`;
				break;
			}
			case 'update':
				successMessage = `✅ Record with id "${recordId}" updated successfully.`;
				break;
			case 'delete':
				successMessage = `✅ Record with id "${recordId}" deleted successfully.`;
				break;
		}

		const structuredContent = {
			operation: operation,
			sObject: sObjectName,
			result: result
		};
		return {
			content: [{
				type: 'text',
				text: JSON.stringify(structuredContent)
			}],
			structuredContent
		};

	} catch (error) {
		log(`Error during DML operation "${operation}" on ${sObjectName}: ${error.message}`);
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

export default dmlOperation;