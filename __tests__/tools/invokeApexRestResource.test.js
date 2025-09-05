import { createMcpClient, disconnectMcpClient } from '../helpers/mcpClient.js';
import { TEST_CONFIG } from '../../test/test-config.js';

describe('invokeApexRestResource', () => {
	let client;

        beforeAll(async () => {
                client = await createMcpClient();
        });

        afterAll(async () => {
                await disconnectMcpClient(client);
        });

	test('invokeApexRestResource GET', async () => {
		const result = await client.callTool('invokeApexRestResource', {
			apexClassOrRestResourceName: TEST_CONFIG.salesforce.testApexRestResourceData.apexClassOrRestResourceName,
			operation: 'GET'
		});
		expect(result?.structuredContent?.endpoint).toBeDefined();
		expect(result.structuredContent.request).toBeDefined();
		expect(result.structuredContent.response).toBeDefined();
		expect(result.structuredContent.request.method).toBe('GET');
		expect(typeof result.structuredContent.status).toBe('number');
	});

	test('invokeApexRestResource POST', async () => {
		const result = await client.callTool('invokeApexRestResource', {
			apexClassOrRestResourceName: TEST_CONFIG.salesforce.testApexRestResourceData.apexClassOrRestResourceName,
			operation: 'POST',
			bodyObject: {test: 'data'}
		});
		expect(result?.structuredContent?.endpoint).toBeDefined();
		expect(result.structuredContent.request.method).toBe('POST');
	});
});
