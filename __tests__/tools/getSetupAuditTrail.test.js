import {TEST_CONFIG} from '../../test/test-config.js';

describe('getSetupAuditTrail', () => {
	let client;

	beforeAll(() => {
		// Utilitzar el client global compartit
		client = global.sharedMcpClient;
		// No fem assert aquí, ho farem al primer test
	});

	test('getSetupAuditTrail basic', async () => {
		// Verificar que el client està definit
		expect(client).toBeDefined();

		const result = await client.callTool('getSetupAuditTrail', {
			lastDays: 7
		});

		expect(result).toBeDefined();
		expect(result?.structuredContent?.filters).toBeDefined();
		expect(typeof result.structuredContent.setupAuditTrailFileTotalRecords).toBe('number');
		expect(Array.isArray(result.structuredContent.records)).toBe(true);
	});

	test('getSetupAuditTrail with user filter', async () => {
		const result = await client.callTool('getSetupAuditTrail', {
			lastDays: 14,
			user: TEST_CONFIG.salesforce.testUser
		});

		expect(result).toBeDefined();
		expect(result?.structuredContent?.filters).toBeDefined();
		expect(result.structuredContent.filters.user).toBe(TEST_CONFIG.salesforce.testUser);
	});
});
