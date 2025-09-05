import {createMcpClient, disconnectMcpClient} from '../helpers/mcpClient.js';

describe('executeAnonymousApex', () => {
	let client;

	beforeAll(async () => {
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
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
