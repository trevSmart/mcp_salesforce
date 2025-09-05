describe('executeSoqlQuery', () => {
	let client;

	beforeAll(() => {
		// Utilitzar el client global compartit
		client = global.sharedMcpClient;
		// No fem assert aquí, ho farem al primer test
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
