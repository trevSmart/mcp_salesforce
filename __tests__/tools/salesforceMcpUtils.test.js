describe('salesforceMcpUtils', () => {
	let client;

	beforeAll(() => {
		// Utilitzar el client global compartit
		client = global.sharedMcpClient;
		// No fem assert aquí, ho farem al primer test
	});

	afterEach(async () => {
		// Clean up after each test
		await new Promise(resolve => setTimeout(resolve, 500));
	});

	test('salesforceMcpUtils getOrgAndUserDetails', async () => {
		const result = await client.callTool('salesforceMcpUtils', {
			action: 'getOrgAndUserDetails'
		});
		expect(result).toBeDefined();
	});

	test('salesforceMcpUtils getState', async () => {
		const result = await client.callTool('salesforceMcpUtils', {
			action: 'getState'
		});
		const sc = result?.structuredContent;
		expect(sc?.state).toBeDefined();
		expect(sc?.client).toBeDefined();
		expect(sc?.resources).toBeDefined();
	});

	test('salesforceMcpUtils loadRecordPrefixesResource', async () => {
		const result = await client.callTool('salesforceMcpUtils', {
			action: 'loadRecordPrefixesResource'
		});
		const sc = result?.structuredContent;
		expect(sc).toBeDefined();
		expect(typeof sc).toBe('object');
		expect(Array.isArray(sc)).toBe(false);
		expect(Object.keys(sc).length).toBeGreaterThan(0);
	});

	test('salesforceMcpUtils getCurrentDatetime', async () => {
		const result = await client.callTool('salesforceMcpUtils', {
			action: 'getCurrentDatetime'
		});
		expect(result?.structuredContent?.now).toBeDefined();
		expect(result?.structuredContent?.timezone).toBeDefined();
	});

	test('salesforceMcpUtils clearCache', async () => {
		const result = await client.callTool('salesforceMcpUtils', {
			action: 'clearCache'
		});
		expect(result?.structuredContent?.status).toBe('success');
		expect(result?.structuredContent?.action).toBe('clearCache');
	});

	test('salesforceMcpUtils reportIssue', async () => {
		const result = await client.callTool('salesforceMcpUtils', {
			action: 'reportIssue',
			issueDescription: 'Test issue for validation',
			issueToolName: 'testTool'
		});
		expect(result?.structuredContent?.success).toBe(true);
		expect(result.structuredContent.issueId).toBeDefined();
	});
});
