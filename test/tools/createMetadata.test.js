

import { createMcpClient, disconnectMcpClient } from '../helpers/mcpClient.js';

describe('createMetadata', () => {
	//TODO borrar fitxers (i carpetes)
	let client;

	beforeAll(async () => {
		// Create and connect to the MCP server
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
	});

	test('Apex class', async () => {
		const result = await client.callTool('createMetadata', {
			type: 'apexClass',
			name: 'TestMCPToolClass'
		});
		expect(result?.structuredContent?.success).toBe(true);
		expect(result.structuredContent.files).toBeTruthy();
	});

	test('Apex test class', async () => {
		const result = await client.callTool('createMetadata', {
			type: 'apexTestClass',
			name: 'TestMCPToolClassTest'
		});
		expect(result?.structuredContent?.success).toBe(true);
	});

	test('Apex trigger', async () => {
		const result = await client.callTool('createMetadata', {
			type: 'apexTrigger',
			name: 'TestMCPToolTrigger',
			triggerSObject: 'Account',
			triggerEvent: ['after insert', 'before update']
		});
		expect(result?.structuredContent?.success).toBe(true);
	});

	test('LWC', async () => {
		const result = await client.callTool('createMetadata', {
			type: 'lwc',
			name: 'testMCPToolComponent'
		});
		expect(result?.structuredContent?.success).toBe(true);
	});
});
