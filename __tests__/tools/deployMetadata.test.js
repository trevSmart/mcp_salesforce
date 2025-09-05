describe('deployMetadata', () => {
	let client;

	beforeAll(() => {
		// Utilitzar el client global compartit
		client = global.sharedMcpClient;
		// No fem assert aquí, ho farem al primer test
	});

	test('deployMetadata validation only', async () => {
		// Verificar que el client està definit
		expect(client).toBeDefined();

		// This test only validates the tool exists and can be called
		// Actual deployment is not tested to avoid destructive operations
		const result = await client.callTool('deployMetadata', {
			sourceDir: 'force-app/main/default/classes/TestClass.cls'
		});

		expect(result).toBeDefined();
	});
});
