// Global test setup and teardown for Jest
import {jest} from '@jest/globals';
import {createMcpClient, disconnectMcpClient} from './helpers/mcpClient.js';

// Increase timeout for all tests
jest.setTimeout(30000);

// Global MCP client that will be shared across all tests
global.sharedMcpClient = null;

// Setup global MCP client before all tests
beforeAll(async () => {
	// Create a single shared MCP client instance
	global.sharedMcpClient = await createMcpClient();
	console.log('Created shared MCP client for all tests');
});

// Global cleanup after all tests
afterAll(async () => {
	// Disconnect the shared MCP client
	if (global.sharedMcpClient) {
		await disconnectMcpClient(global.sharedMcpClient);
		console.log('Disconnected shared MCP client');
	}

	// Give some time for cleanup
	await new Promise(resolve => setTimeout(resolve, 1000));

	// Force cleanup of any remaining handles
	if (global.gc) {
		global.gc();
	}
});

// Clean up after each test
afterEach(async () => {
	// Clear any timers that might be left running
	jest.clearAllTimers();

	// Give a small delay to allow cleanup
	await new Promise(resolve => setTimeout(resolve, 100));
});
