import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestMcpClient } from 'ibm-test-mcp-client';
import { TEST_CONFIG } from '../../test/test-config.js';

describe('executeAnonymousApex', () => {
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

	test('executeAnonymousApex simple', async () => {
		const result = await client.callTool('executeAnonymousApex', {
			apexCode: "System.debug('Hello from MCP tool test');\nSystem.debug('Current time: ' + Datetime.now());",
			mayModify: false
		});
		expect(result?.structuredContent?.success).toBe(true);
		expect(result.structuredContent.debugLogs).toBeDefined();
	});

	test('executeAnonymousApex with modification', async () => {
		const result = await client.callTool('executeAnonymousApex', {
			apexCode: "Account acc = new Account(Name='Test Account');\ninsert acc;\nSystem.debug('Created account: ' + acc.Id);",
			mayModify: true
		});
		expect(result?.structuredContent?.success).toBe(true);
	});
});
