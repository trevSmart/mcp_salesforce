import {TEST_CONFIG} from '../../test/test-config.js';

describe('dmlOperation', () => {
	let client;

	beforeAll(() => {
		// Utilitzar el client global compartit
		client = global.sharedMcpClient;
		// No fem assert aquí, ho farem al primer test
	});

	test('dmlOperation create', async () => {
		// Verificar que el client està definit
		expect(client).toBeDefined();

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

		expect(result).toBeDefined();
		expect(result?.structuredContent?.outcome).toBeDefined();
		expect(result.structuredContent.successes).toBeDefined();
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

		expect(result).toBeDefined();
		expect(result?.structuredContent?.outcome).toBeDefined();
	});
});
