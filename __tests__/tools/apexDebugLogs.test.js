import { createMcpClient, disconnectMcpClient } from '../helpers/mcpClient.js';
import { TEST_CONFIG } from '../../test/test-config.js';

describe('apexDebugLogs', () => {
	let client;
	let logsList; // Variable compartida per dependències

        beforeAll(async () => {
                client = await createMcpClient();
        });

        afterAll(async () => {
                await disconnectMcpClient(client);
        });

	test('apexDebugLogs status', async () => {
		const result = await client.callTool('apexDebugLogs', {action: 'status'});
		expect(result).toBeDefined();
	});

	test('apexDebugLogs on', async () => {
		const result = await client.callTool('apexDebugLogs', {action: 'on'});
		expect(result).toBeDefined();
	});

	test('apexDebugLogs list', async () => {
		const result = await client.callTool('apexDebugLogs', {action: 'list'});
		expect(result?.structuredContent?.logs).toBeDefined();
		expect(Array.isArray(result.structuredContent.logs)).toBe(true);

		// Guardar el resultat per altres tests
		logsList = result.structuredContent.logs;
	});

	test('apexDebugLogs get', async () => {
		// Utilitzar la variable compartida del test anterior
		expect(logsList).toBeDefined();
		expect(Array.isArray(logsList)).toBe(true);

		// If no logs available, skip the test
		if (logsList.length === 0) {
			console.log('No logs available for apexDebugLogs get test, skipping...');
			return;
		}

		// Use the first available log
		const firstLog = logsList[0];
		const logId = firstLog.Id;

		// Now get the specific log content
		const result = await client.callTool('apexDebugLogs', {action: 'get', logId: logId});
		expect(result?.structuredContent?.logContent).toBeDefined();
	});

	test('apexDebugLogs off', async () => {
		const result = await client.callTool('apexDebugLogs', {action: 'off'});
		expect(result).toBeDefined();
	});
});
