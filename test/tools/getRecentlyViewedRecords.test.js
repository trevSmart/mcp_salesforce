

import {createMcpClient, disconnectMcpClient} from '../testMcpClient.js';

describe('getRecentlyViewedRecords', () => {
	let client;

	beforeAll(async () => {
		// Create and connect to the MCP server
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
	});

	test('getRecentlyViewedRecords', async () => {
		const result = await client.callTool('getRecentlyViewedRecords', {});
		const sc = result?.structuredContent;
		expect(sc?.records).toBeTruthy();
		expect(Array.isArray(sc.records)).toBe(true);
		expect(typeof sc.totalSize).toBe('number');
		expect(sc.totalSize).toBeGreaterThan(0);
	});
});
