
import {createMcpClient, disconnectMcpClient} from '../helpers/mcpClient.js';
import {TEST_CONFIG} from '../setup.js';

describe('invokeApexRestResource', () => {
	let client;

	beforeAll(async () => {
		// Create and connect to the MCP server
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
		// Additional cleanup time
		await new Promise((resolve) => setTimeout(resolve, 2000));
	});

	afterEach(async () => {
		// Clean up after each test
		await new Promise(resolve => setTimeout(resolve, 500));
	});

	test('invokeApexRestResource GET', async () => {
		const result = await client.callTool('invokeApexRestResource', {
			apexClassOrRestResourceName: TEST_CONFIG.salesforce.testApexRestResourceData.apexClassOrRestResourceName,
			operation: 'GET'
		});
		expect(result?.structuredContent?.endpoint).toBeTruthy();
		expect(result.structuredContent.request).toBeTruthy();
		expect(result.structuredContent.responseBody).toBeTruthy();
		expect(result.structuredContent.request.method).toBe('GET');
		expect(typeof result.structuredContent.status).toBe('number');
	});

	test('invokeApexRestResource POST', async () => {
		const result = await client.callTool('invokeApexRestResource', {
			apexClassOrRestResourceName: TEST_CONFIG.salesforce.testApexRestResourceData.apexClassOrRestResourceName,
			operation: 'POST',
			bodyObject: {test: 'data'}
		});
		expect(result?.structuredContent?.endpoint).toBeTruthy();
		expect(result.structuredContent.request.method).toBe('POST');
		expect(result.structuredContent.responseBody).toBeTruthy();
	});
});
