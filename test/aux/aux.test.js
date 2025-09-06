import {main} from '../../index.js';
import {mcpServer} from '../../src/mcp-server.js';


describe('aux', () => {

	beforeAll(async () => {
		// Create and connect to the MCP server
		await main();
	});

	afterAll(async () => {
		await mcpServer.close();
	});

	test('validation only', async () => {
		// Verificar que el client està definit
		expect(mcpServer).toBeTruthy();

		// This test only validates the tool exists and can be called
		// Actual deployment is not tested to avoid destructive operations
		const result = await mcpServer.callTool('deployMetadata', {
			sourceDir: 'force-app/main/default/classes/TestClass.cls'
		});

		expect(result).toBeTruthy();
	});
});
