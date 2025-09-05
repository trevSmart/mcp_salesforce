import {createMcpClient, disconnectMcpClient} from '../helpers/mcpClient.js';

describe('apex-run-script', () => {
	let client;

	beforeAll(async () => {
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
	});

	test('apex-run-script prompt', async () => {
		const result = await client.callPrompt('apex-run-script', {
			currentBehavior: 'Current code does nothing',
			desiredBehavior: 'Code should return a greeting message',
			updateTests: 'Yes'
		});
		const hasMessages = result?.messages;
		const isArray = Array.isArray(result?.messages);
		const isValidMessages = hasMessages && isArray;
		expect(isValidMessages).toBe(true);
		expect(result.messages.length).toBeGreaterThan(0);
	});
});
