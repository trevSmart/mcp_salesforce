import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestMcpClient } from 'ibm-test-mcp-client';
import { TEST_CONFIG } from '../../test/test-config.js';

describe('apex-run-script', () => {
	let client;

	beforeAll(async () => {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);
		const serverPath = resolve(__dirname, '../../../src/mcp-server.js');
		client = new TestMcpClient();
		await client.connect({
			kind: 'script',
			interpreter: 'node',
			path: serverPath,
			args: ['--stdio']
		});
	});

	afterAll(async () => {
		if (client) {
			await client.disconnect();
		}
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
