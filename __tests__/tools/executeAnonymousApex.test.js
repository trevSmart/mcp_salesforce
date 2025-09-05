describe('executeAnonymousApex', () => {
	let client;

	beforeAll(() => {
		// Utilitzar el client global compartit
		client = global.sharedMcpClient;
		// No fem assert aquí, ho farem al primer test
	});

	test('executeAnonymousApex simple', async () => {
		// Verificar que el client està definit
		expect(client).toBeDefined();

		const result = await client.callTool('executeAnonymousApex', {
			apexCode: "System.debug('Hello from MCP tool test');\nSystem.debug('Current time: ' + Datetime.now());",
			mayModify: false
		});
		expect(result).toBeDefined();

		// Comprovem que el resultat té l'estructura esperada
		if (result?.structuredContent?.success !== undefined) {
			expect(result.structuredContent.success).toBe(true);
		}

		if (result?.structuredContent?.logs) {
			expect(result.structuredContent.logs).toContain('Hello from MCP tool test');
		}
	});

	test('executeAnonymousApex with modification', async () => {
		const result = await client.callTool('executeAnonymousApex', {
			apexCode: "Account acc = new Account(Name='Test Account');\ninsert acc;\nSystem.debug('Created account: ' + acc.Id);",
			mayModify: true
		});
		expect(result?.structuredContent?.success).toBe(true);
	});
});
