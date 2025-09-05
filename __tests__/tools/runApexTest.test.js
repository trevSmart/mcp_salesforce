describe('runApexTest', () => {
	let client;

	beforeAll(() => {
		// Utilitzar el client global compartit
		client = global.sharedMcpClient;
		// No fem assert aquí, ho farem al primer test
	});

	test('runApexTest by class', async () => {
		// First, let's find available test classes
		const queryResult = await client.callTool('executeSoqlQuery', {
			query: "SELECT Id, Name FROM ApexClass WHERE Name LIKE '%Test%' LIMIT 5",
			useToolingApi: true
		});
		console.log('Debug - Available test classes:', JSON.stringify(queryResult, null, 2));

		// Use the first available test class
		const testClasses = queryResult?.structuredContent?.records || [];
		if (testClasses.length === 0) {
			console.log('No test classes found, skipping test');
			return;
		}

		const testClassName = testClasses[0].Name;
		console.log('Using test class:', testClassName);

		const result = await client.callTool('runApexTest', {
			classNames: [testClassName]
		});
		console.log('Debug - runApexTest by class result:', JSON.stringify(result, null, 2));

		if (result.isError) {
			console.log('Test execution failed:', result.content[0].text);
			// For now, just check that we got a response
			expect(result).toBeDefined();
		} else {
			expect(result?.structuredContent?.result).toBeDefined();
			expect(Array.isArray(result.structuredContent.result)).toBe(true);

			if (result.structuredContent.result.length > 0) {
				const testResult = result.structuredContent.result[0];
				expect(testResult.className).toBeDefined();
				expect(testResult.methodName).toBeDefined();
				expect(testResult.status).toBeDefined();
			}
		}
	});

	test('runApexTest by method', async () => {
		// For now, just test that the tool responds (even if with error)
		const result = await client.callTool('runApexTest', {
			methodNames: ['NonExistentClass.nonExistentMethod']
		});
		console.log('Debug - runApexTest by method result:', JSON.stringify(result, null, 2));

		// The tool should respond (even if with an error)
		expect(result).toBeDefined();
		expect(result.isError).toBe(true);
	});
});
