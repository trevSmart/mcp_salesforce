import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestMcpClient } from 'ibm-test-mcp-client';
import { TEST_CONFIG } from '../../test/test-config.js';

describe('describeObject', () => {
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

	test('describeObject Account', async () => {
		const result = await client.callTool('describeObject', {
			sObjectName: 'Account'
		});
		expect(result?.structuredContent).toBeDefined();
		expect(result.structuredContent.name).toBe('Account');
		expect(Array.isArray(result.structuredContent.fields)).toBe(true);
		expect(result.structuredContent.fields.length).toBeGreaterThan(0);
	});

	test('describeObject Contact', async () => {
		const result = await client.callTool('describeObject', {
			sObjectName: 'Contact'
		});
		expect(result?.structuredContent).toBeDefined();
		expect(result.structuredContent.name).toBe('Contact');
	});

	test('describeObject with includeFields false', async () => {
		const result = await client.callTool('describeObject', {
			sObjectName: 'Account',
			includeFields: false
		});
		expect(result?.structuredContent).toBeDefined();
		expect(result.structuredContent.wasCached).toBe(true);
	});
});
