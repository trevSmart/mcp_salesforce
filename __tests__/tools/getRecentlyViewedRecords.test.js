describe('getRecentlyViewedRecords', () => {
	let client;

	beforeAll(() => {
		// Utilitzar el client global compartit
		client = global.sharedMcpClient;
		// No fem assert aquí, ho farem al primer test
	});

	test('getRecentlyViewedRecords', async () => {
		const result = await client.callTool('getRecentlyViewedRecords', {});
		const sc = result?.structuredContent;
		expect(sc?.records).toBeDefined();
		expect(Array.isArray(sc.records)).toBe(true);
		expect(typeof sc.totalSize).toBe('number');
	});
});
