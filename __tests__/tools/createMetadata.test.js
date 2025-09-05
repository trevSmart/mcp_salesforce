import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestMcpClient } from 'ibm-test-mcp-client';
import { TEST_CONFIG } from '../../test/test-config.js';

describe('createMetadata', () => {
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

	test('createMetadata Apex Class', async () => {
		const result = await client.callTool('createMetadata', {
			type: 'apexClass',
			name: 'TestMCPToolClass'
		});
		expect(result?.structuredContent?.success).toBe(true);
		expect(result.structuredContent.files).toBeDefined();
	});

	test('createMetadata Apex Test Class', async () => {
		const result = await client.callTool('createMetadata', {
			type: 'apexTestClass',
			name: 'TestMCPToolClassTest'
		});
		expect(result?.structuredContent?.success).toBe(true);
	});

	test('createMetadata Apex Trigger', async () => {
		const result = await client.callTool('createMetadata', {
			type: 'apexTrigger',
			name: 'TestMCPToolTrigger',
			triggerSObject: 'Account',
			triggerEvent: ['after insert', 'before update']
		});
		expect(result?.structuredContent?.success).toBe(true);
	});

	test('createMetadata LWC', async () => {
		const result = await client.callTool('createMetadata', {
			type: 'lwc',
			name: 'testMCPToolComponent'
		});
		expect(result?.structuredContent?.success).toBe(true);
	});
});
