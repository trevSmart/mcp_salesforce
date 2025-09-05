describe('getApexClassCodeCoverage', () => {
	let client;

	beforeAll(() => {
		// Utilitzar el client global compartit
		client = global.sharedMcpClient;
		// No fem assert aquí, ho farem al primer test
	});

	test('getApexClassCodeCoverage', async () => {
		const result = await client.callTool('getApexClassCodeCoverage', {
			classNames: ['TestMCPTool']
		});
		expect(result?.structuredContent?.classes).toBeDefined();
		expect(Array.isArray(result.structuredContent.classes)).toBe(true);

		if (result.structuredContent.classes.length > 0) {
			const classCoverage = result.structuredContent.classes[0];
			expect(classCoverage.className).toBeDefined();
			expect(typeof classCoverage.percentage).toBe('number');
		}
	});
});
