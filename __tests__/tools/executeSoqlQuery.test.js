import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestMcpClient } from 'ibm-test-mcp-client';

describe('executeSoqlQuery', () => {
	let client;

	beforeAll(async () => {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);
		const serverPath = resolve(__dirname, '../../src/mcp-server.js');
		client = new TestMcpClient();
		await client.connect({
			kind: 'script',
			interpreter: 'node',
			path: serverPath,
			args: ['--stdio']
		});
		// Wait for server to initialize
		await new Promise(resolve => setTimeout(resolve, 2000));
	});

	afterAll(async () => {
		if (client) {
			await client.disconnect();
		}
	});

	test('executeSoqlQuery', async () => {
		const result = await client.callTool('executeSoqlQuery', {
			query: 'SELECT Id, Name FROM Account LIMIT 3'
		});
		const sc = result?.structuredContent;
		expect(sc).toBeDefined();
		expect(Array.isArray(sc.records)).toBe(true);

		if (sc.records.length > 0) {
			const r = sc.records[0];
			expect(r.Id).toBeDefined();
			expect(r.Name).toBeDefined();
		}
	});

	test('executeSoqlQuery with Tooling API', async () => {
		const result = await client.callTool('executeSoqlQuery', {
			query: 'SELECT Id, Name FROM ApexClass LIMIT 3',
			useToolingApi: true
		});
		const sc = result?.structuredContent;
		expect(sc).toBeDefined();
		expect(Array.isArray(sc.records)).toBe(true);
	});
});
