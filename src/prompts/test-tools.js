import {z} from 'zod';
import {completable} from '@modelcontextprotocol/sdk/server/completable.js';
import config from '../config.js';

export const testToolsPromptDefinition = {
	title: 'Test tools',
	description: 'Test tools prompt for testing purposes',
	argsSchema: {
		executeTest: completable(z.enum(['Yes', 'No']), value => ['Yes', 'No'].filter(d => d.toLowerCase().startsWith(value.toLowerCase())))
	}
};

export function testToolsPrompt() {
	return {
		messages: [
			{
				role: 'user',
				content: {
					type: 'text',
					text: `We need to perform an exhaustive test of all the tools in the ${config.SERVER_CONSTANTS.serverInfo.name}.
Call every tool. For tools thann can perform several actions, make sure to call all the possible actions.
For tools that create records, try to clean up the records after the test.
For tools that require an Apex class name as parameter (deployMetadata, getApexClassCodeCoverage), use the class "CBSD_Utils". For Apex test classes, use the class "CBSD_Utils_Test".
For tools that require a record ID as parameter (getRecord, dmlOperation with actions "update" and "delete"), use the record Id of the record created with the call to dmlOperation with action "create".
For all the actions in the createMetadata tool, delete the metadata files created by the tool after the test.`
				}
			}
		]
	};
}
