
import {createMcpClient, disconnectMcpClient} from '../helpers/mcpClient.js';
import {TEST_CONFIG} from '../setup.js';

describe('dmlOperation', () => {
	let client;

	beforeAll(async () => {
		// Create and connect to the MCP server
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
		// Additional cleanup time
		await new Promise((resolve) => setTimeout(resolve, 2000));
	});

	test('dmlOperation create', async () => {
		// Verificar que el client està definit
		expect(client).toBeTruthy();

		const result = await client.callTool('dmlOperation', {
			operations: {
				create: [
					{
						sObjectName: 'Account',
						fields: {
							// biome-ignore lint/style/useNamingConvention: Salesforce field names must be PascalCase
							Name: 'Test MCP Tool Account',
							// biome-ignore lint/style/useNamingConvention: Salesforce field names must be PascalCase
							Description: 'Account created by MCP tool test'
						}
					}
				]
			}
		});

		expect(result?.structuredContent?.outcome).toBeTruthyAndDump(result);
	});

	test('dmlOperation update', async () => {
		const result = await client.callTool('dmlOperation', {
			operations: {
				update: [
					{
						sObjectName: 'Account',
						recordId: TEST_CONFIG.salesforce.testAccountId,
						fields: {
							// biome-ignore lint/style/useNamingConvention: Salesforce field names must be PascalCase
							Description: `Updated by MCP Tool test at ${new Date().toISOString()}`
						}
					}
				]
			}
		});

		expect(result).toBeTruthy();
		expect(result?.structuredContent?.outcome).toBeTruthyAndDump(result?.structuredContent);
	});
});
