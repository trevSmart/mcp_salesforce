import {createMcpClient, disconnectMcpClient} from '../helpers/mcpClient.js';
import {TEST_CONFIG} from '../../test/test-config.js';

describe('getRecord', () => {
	let client;

	beforeAll(async () => {
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
	});

	test('getRecord Account', async () => {
		const result = await client.callTool('getRecord', {
			sObjectName: 'Account',
			recordId: TEST_CONFIG.salesforce.testAccountId
		});
		expect(result?.structuredContent).toBeDefined();
		expect(result.structuredContent.sObject).toBe('Account');
		expect(result.structuredContent.fields).toBeDefined();
	});

	test('getRecord Contact', async () => {
		const result = await client.callTool('getRecord', {
			sObjectName: 'Contact',
			recordId: TEST_CONFIG.salesforce.testContactId
		});
		expect(result?.structuredContent).toBeDefined();
		expect(result.structuredContent.sObject).toBe('Contact');
	});
});
