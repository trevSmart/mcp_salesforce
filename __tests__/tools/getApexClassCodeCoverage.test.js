import {createMcpClient, disconnectMcpClient} from '../helpers/mcpClient.js';

describe('getApexClassCodeCoverage', () => {
	let client;

	beforeAll(async () => {
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
	});

	test('getApexClassCodeCoverage', async () => {
		const result = await client.callTool('getApexClassCodeCoverage', {
			classNames: ['TestMCPTool']
		});
		expect(result?.structuredContent?.classes).toBeDefined();
		expect(Array.isArray(result.structuredContent.classes)).toBe(true);

		if (result.structuredContent.classes.length > 0) {
			const classCoverage = result.structuredContent.classes[0];
			expect(classCoverage.className).toBeDefined();
			expect(typeof classCoverage.percentage).toBe('number');
		}
	});
});
