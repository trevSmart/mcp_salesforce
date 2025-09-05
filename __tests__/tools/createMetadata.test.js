describe('createMetadata', () => {
		//TODO borrar fitxers (i carpetes)
		let client;

		beforeAll(() => {
			// Utilitzar el client global compartit
			client = global.sharedMcpClient;
			// No fem assert aquí, ho farem al primer test
		});

		test('createMetadata Apex Class', async () => {
			const result = await client.callTool('createMetadata', {
				type: 'apexClass',
				name: 'TestMCPToolClass'
			});
			expect(result?.structuredContent?.success).toBe(true);
			expect(result.structuredContent.files).toBeDefined();
		});

		test('createMetadata Apex Test Class', async () => {
			const result = await client.callTool('createMetadata', {
				type: 'apexTestClass',
				name: 'TestMCPToolClassTest'
			});
			expect(result?.structuredContent?.success).toBe(true);
		});

		test('createMetadata Apex Trigger', async () => {
			const result = await client.callTool('createMetadata', {
				type: 'apexTrigger',
				name: 'TestMCPToolTrigger',
				triggerSObject: 'Account',
				triggerEvent: ['after insert', 'before update']
			});
			expect(result?.structuredContent?.success).toBe(true);
		});

		test('createMetadata LWC', async () => {
			const result = await client.callTool('createMetadata', {
				type: 'lwc',
				name: 'testMCPToolComponent'
			});
			expect(result?.structuredContent?.success).toBe(true);
		});
	});
