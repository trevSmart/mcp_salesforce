
import {createMcpClient, disconnectMcpClient} from '../helpers/mcpClient.js';
import {TEST_CONFIG} from '../setup.js';

describe('getSetupAuditTrail', () => {
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

	test('getSetupAuditTrail basic', async () => {
		// Verificar que el client està definit
		expect(client).toBeTruthy();

		const result = await client.callTool('getSetupAuditTrail', {
			lastDays: 7
		});

		expect(result).toBeTruthy();
		expect(result?.structuredContent?.filters).toBeTruthy();
		expect(typeof result.structuredContent.setupAuditTrailFileTotalRecords).toBe('number');
		expect(Array.isArray(result.structuredContent.records)).toBe(true);
	});

	test('getSetupAuditTrail with user filter', async () => {
		const result = await client.callTool('getSetupAuditTrail', {
			lastDays: 14,
			user: TEST_CONFIG.salesforce.testUser
		});

		expect(result).toBeTruthy();
		expect(result?.structuredContent?.filters).toBeTruthy();
		expect(result.structuredContent.filters.user).toBe(TEST_CONFIG.salesforce.testUser);
	});
});
