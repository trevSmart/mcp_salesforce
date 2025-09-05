import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestMcpClient } from 'ibm-test-mcp-client';
import { TEST_CONFIG } from '../../test/test-config.js';

describe('runApexTest', () => {
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

	test('runApexTest by class', async () => {
		const result = await client.callTool('runApexTest', {
			classNames: ['TestMCPToolTest']
		});
		expect(result?.structuredContent?.result).toBeDefined();
		expect(Array.isArray(result.structuredContent.result)).toBe(true);

		if (result.structuredContent.result.length > 0) {
			const testResult = result.structuredContent.result[0];
			expect(testResult.className).toBeDefined();
			expect(testResult.methodName).toBeDefined();
			expect(testResult.status).toBeDefined();
		}
	});

	test('runApexTest by method', async () => {
		const result = await client.callTool('runApexTest', {
			methodNames: ['TestMCPToolTest.testMethod']
		});
		expect(result?.structuredContent?.result).toBeDefined();
	});
});
