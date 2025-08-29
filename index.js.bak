import {createLogger} from './src/lib/logger.js';
import {mcpServer, setupServer} from './src/mcp-server.js';

export async function main() {
	try {
		await setupServer();

	} catch (error) {
		const logger = createLogger();
		logger.error(error, 'Error starting IBM MCP Salesforce server');
		await mcpServer.close();
		process.exit(1);
	}
}

main();
