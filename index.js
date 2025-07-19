import {log} from './src/utils.js';
import {mcpServer, setupServer} from './src/mcp-server.js';

export async function main() {
	try {
		await setupServer();

	} catch (error) {
		log(`Error starting IBM MCP Salesforce server: ${error.message}`, 'error');
		await mcpServer.close();
		process.exit(1);
	}
}

main();