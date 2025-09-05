describe('describeObject', () => {
	let client;

	beforeAll(() => {
		// Utilitzar el client global compartit
		client = global.sharedMcpClient;
		// No fem assert aquí, ho farem al primer test
	});

	test('describeObject Account', async () => {
		const result = await client.callTool('describeObject', {
			sObjectName: 'Account'
		});
		expect(result?.structuredContent).toBeDefined();
		expect(result.structuredContent.name).toBe('Account');
		expect(Array.isArray(result.structuredContent.fields)).toBe(true);
		expect(result.structuredContent.fields.length).toBeGreaterThan(0);
	});

	test('describeObject Contact', async () => {
		const result = await client.callTool('describeObject', {
			sObjectName: 'Contact'
		});
		expect(result?.structuredContent).toBeDefined();
		expect(result.structuredContent.name).toBe('Contact');
	});

	test('describeObject with includeFields false', async () => {
		const result = await client.callTool('describeObject', {
			sObjectName: 'Account',
			includeFields: false
		});
		expect(result?.structuredContent).toBeDefined();
		expect(result.structuredContent.wasCached).toBe(true);
	});
});
