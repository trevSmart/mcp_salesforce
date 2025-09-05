import {createMcpClient, disconnectMcpClient} from '../helpers/mcpClient.js';

describe('getRecentlyViewedRecords', () => {
	let client;

	beforeAll(async () => {
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
	});

	test('getRecentlyViewedRecords', async () => {
		const result = await client.callTool('getRecentlyViewedRecords', {});
		const sc = result?.structuredContent;
		expect(sc?.records).toBeDefined();
		expect(Array.isArray(sc.records)).toBe(true);
		expect(typeof sc.totalSize).toBe('number');
	});
});
