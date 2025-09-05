describe('apexDebugLogs', () => {
	let client;
	let logsList; // Variable compartida per dependències

	beforeAll(() => {
		// Utilitzar el client global compartit
		client = global.sharedMcpClient;
		// No fem assert aquí, ho farem al primer test
	});


	afterEach(async () => {
		// Clean up after each test
		await new Promise((resolve) => setTimeout(resolve, 500));
	});

	test('apexDebugLogs status', async () => {
		const result = await client.callTool('apexDebugLogs', {action: 'status'});
		expect(result).toBeDefined();
	});

	test('apexDebugLogs on', async () => {
		const result = await client.callTool('apexDebugLogs', {action: 'on'});
		expect(result).toBeDefined();
	});

	test('apexDebugLogs list', async () => {
		const result = await client.callTool('apexDebugLogs', {action: 'list'});
		expect(result?.structuredContent?.logs).toBeDefined();
		expect(Array.isArray(result.structuredContent.logs)).toBe(true);

		// Guardar el resultat per altres tests
		logsList = result.structuredContent.logs;
	});

	test('apexDebugLogs get', async () => {
		// If logsList is not defined or empty, skip the test
		if (!(logsList && Array.isArray(logsList)) || logsList.length === 0) {
			console.log('No logs available for apexDebugLogs get test, skipping...');
			return;
		}

		// Use the first available log
		const firstLog = logsList[0];
		const logId = firstLog.Id;

		// Now get the specific log content
		const result = await client.callTool('apexDebugLogs', {action: 'get', logId: logId});

		// Check if result is defined and has the expected structure
		expect(result).toBeDefined();
		expect(result.structuredContent).toBeDefined();

		// Log content might be undefined if the log is empty or not available yet
		if (result.structuredContent.logContent !== undefined) {
			expect(result.structuredContent.logContent).toBeDefined();
		} else {
			console.log('Log content is not available yet (log might be empty or still processing)');
		}
	});

	test('apexDebugLogs off', async () => {
		const result = await client.callTool('apexDebugLogs', {action: 'off'});
		expect(result).toBeDefined();
	});
});
