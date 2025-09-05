import { createMcpClient, disconnectMcpClient } from '../helpers/mcpClient.js';
import { TEST_CONFIG } from '../../test/test-config.js';

describe('runApexTest', () => {
	let client;

        beforeAll(async () => {
                client = await createMcpClient();
        });

        afterAll(async () => {
                await disconnectMcpClient(client);
        });

	test('runApexTest by class', async () => {
		const result = await client.callTool('runApexTest', {
			classNames: ['TestMCPToolTest']
		});
		expect(result?.structuredContent?.result).toBeDefined();
		expect(Array.isArray(result.structuredContent.result)).toBe(true);

		if (result.structuredContent.result.length > 0) {
			const testResult = result.structuredContent.result[0];
			expect(testResult.className).toBeDefined();
			expect(testResult.methodName).toBeDefined();
			expect(testResult.status).toBeDefined();
		}
	});

	test('runApexTest by method', async () => {
		const result = await client.callTool('runApexTest', {
			methodNames: ['TestMCPToolTest.testMethod']
		});
		expect(result?.structuredContent?.result).toBeDefined();
	});
});
