import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestMcpClient } from 'ibm-test-mcp-client';
import { TEST_CONFIG } from '../../test/test-config.js';

describe('getRecentlyViewedRecords', () => {
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

	test('getRecentlyViewedRecords', async () => {
		const result = await client.callTool('getRecentlyViewedRecords', {});
		const sc = result?.structuredContent;
		expect(sc?.records).toBeDefined();
		expect(Array.isArray(sc.records)).toBe(true);
		expect(typeof sc.totalSize).toBe('number');
	});
});
