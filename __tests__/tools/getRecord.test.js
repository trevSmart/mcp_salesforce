import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestMcpClient } from 'ibm-test-mcp-client';
import { TEST_CONFIG } from '../../test/test-config.js';

describe('getRecord', () => {
	let client;

	beforeAll(async () => {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);
		const serverPath = resolve(__dirname, '../../../src/mcp-server.js');
		client = new TestMcpClient();
		await client.connect({
			kind: 'script',
			interpreter: 'node',
			path: serverPath,
			args: ['--stdio']
		});
	});

	afterAll(async () => {
		if (client) {
			await client.disconnect();
		}
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
