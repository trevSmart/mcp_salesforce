import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestMcpClient } from 'ibm-test-mcp-client';
import { TEST_CONFIG } from '../../test/test-config.js';

describe('invokeApexRestResource', () => {
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

	test('invokeApexRestResource GET', async () => {
		const result = await client.callTool('invokeApexRestResource', {
			apexClassOrRestResourceName: TEST_CONFIG.salesforce.testApexRestResourceData.apexClassOrRestResourceName,
			operation: 'GET'
		});
		expect(result?.structuredContent?.endpoint).toBeDefined();
		expect(result.structuredContent.request).toBeDefined();
		expect(result.structuredContent.response).toBeDefined();
		expect(result.structuredContent.request.method).toBe('GET');
		expect(typeof result.structuredContent.status).toBe('number');
	});

	test('invokeApexRestResource POST', async () => {
		const result = await client.callTool('invokeApexRestResource', {
			apexClassOrRestResourceName: TEST_CONFIG.salesforce.testApexRestResourceData.apexClassOrRestResourceName,
			operation: 'POST',
			bodyObject: {test: 'data'}
		});
		expect(result?.structuredContent?.endpoint).toBeDefined();
		expect(result.structuredContent.request.method).toBe('POST');
	});
});
