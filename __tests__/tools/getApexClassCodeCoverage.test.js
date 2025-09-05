import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestMcpClient } from 'ibm-test-mcp-client';
import { TEST_CONFIG } from '../../test/test-config.js';

describe('getApexClassCodeCoverage', () => {
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

	test('getApexClassCodeCoverage', async () => {
		const result = await client.callTool('getApexClassCodeCoverage', {
			classNames: ['TestMCPTool']
		});
		expect(result?.structuredContent?.classes).toBeDefined();
		expect(Array.isArray(result.structuredContent.classes)).toBe(true);

		if (result.structuredContent.classes.length > 0) {
			const classCoverage = result.structuredContent.classes[0];
			expect(classCoverage.className).toBeDefined();
			expect(typeof classCoverage.percentage).toBe('number');
		}
	});
});
