import {createLogger} from './src/lib/logger.js';
import {mcpServer, setupServer} from './src/mcp-server.js';

export async function main(transport) {
	try {
		if (transport.toLowerCase() !== 'stdio' && transport.toLowerCase() !== 'http') {
			return;
		}
		await setupServer(transport);
	} catch (error) {
		const logger = createLogger();
		logger.error(error, 'Error starting IBM MCP Salesforce server');
		await mcpServer.close();
		process.exit(1);
	}
}

// Get transport from command line arguments or default to 'stdio'
const transport = process.argv[2] || 'stdio';
main(transport);
