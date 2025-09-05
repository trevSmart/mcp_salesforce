
import {createMcpClient, disconnectMcpClient} from '../helpers/mcpClient.js';
import {TEST_CONFIG} from '../setup.js';

describe('getRecord', () => {
	let client;

	beforeAll(async () => {
		// Create and connect to the MCP server
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
		// Additional cleanup time
		await new Promise((resolve) => setTimeout(resolve, 2000));
	});

	test('getRecord Account', async () => {
		const result = await client.callTool('getRecord', {
			sObjectName: 'Account',
			recordId: TEST_CONFIG.salesforce.testAccountId
		});
		expect(result?.structuredContent).toBeTruthy();
		expect(result.structuredContent.sObject).toBe('Account');
		expect(result.structuredContent.fields).toBeTruthy();
	});

	test('getRecord with non-existent SObject should return error', async () => {
		const result = await client.callTool('getRecord', {
			sObjectName: 'NonExistentObject__c',
			recordId: '001000000000000AAA'
		});

		// Verify that the result indicates an error
		expect(result.isError).toBe(true);
		expect(result.content).toBeTruthy();
		expect(result.content[0].type).toBe('text');
		expect(result.content[0].text).toContain('error');
	});

});
