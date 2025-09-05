import {TEST_CONFIG} from '../../test/test-config.js';

describe('invokeApexRestResource', () => {
	let client;

	beforeAll(() => {
		// Utilitzar el client global compartit
		client = global.sharedMcpClient;
		// No fem assert aquí, ho farem al primer test
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
		expect(result?.structuredContent?.endpoint).toBeDefined();
		expect(result.structuredContent.request).toBeDefined();
		expect(result.structuredContent.responseBody).toBeDefined();
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
		expect(result.structuredContent.responseBody).toBeDefined();
	});
});
