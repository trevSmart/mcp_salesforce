import { createMcpClient, disconnectMcpClient } from '../helpers/mcpClient.js';

describe('salesforceMcpUtils', () => {
	let client;

	beforeAll(async () => {
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
		await new Promise((resolve) => setTimeout(resolve, 2000));
	});

	afterEach(async () => {
		await new Promise((resolve) => setTimeout(resolve, 500));
	});

	test('salesforceMcpUtils getOrgAndUserDetails', async () => {
		const result = await client.callTool('salesforceMcpUtils', {
			action: 'getOrgAndUserDetails'
		});
		expect(result?.structuredContent?.user?.id).toBeTruthyAndDump(result?.structuredContent);
	});

	test('salesforceMcpUtils getState', async () => {
		const result = await client.callTool('salesforceMcpUtils', {action: 'getState'});

		// ÚS DEL MATCHER PERSONALITZAT
		// Si no és true, escriu structuredContent a .test-artifacts/
		expect(result?.structuredContent?.state?.org?.user?.id).toBeTruthyAndDump(result?.structuredContent);
	});

	test('salesforceMcpUtils loadRecordPrefixesResource', async () => {
		const result = await client.callTool('salesforceMcpUtils', {
			action: 'loadRecordPrefixesResource'
		});
		const content = result?.content;
		expect(Array.isArray(content)).toBe(true);
		expect(content.some(item => item.type === 'resource_link' && item.uri)).toBeTruthyAndDump(content);

		const structuredContent = result?.structuredContent;
		expect(structuredContent).toBeTruthy();
		expect(typeof structuredContent).toBe('object');
		expect(Array.isArray(structuredContent)).toBe(false);
		expect(Object.keys(structuredContent).length).toBeGreaterThan(0);
	});

	test('salesforceMcpUtils getCurrentDatetime', async () => {
		const result = await client.callTool('salesforceMcpUtils', {
			action: 'getCurrentDatetime'
		});
		expect(result?.structuredContent?.now).toBeTruthy();
		expect(result?.structuredContent?.timezone).toBeTruthy();
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
		expect(result.structuredContent.issueId).toBeTruthy();
	});
});