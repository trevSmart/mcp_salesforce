import {createLogger} from './src/lib/logger.js';
import {mcpServer, setupServer} from './src/mcp-server.js';

export async function main(rawTransport) {
	try {
		const transport = (rawTransport || 'stdio').replace(/^--/, '').toLowerCase();
		if (transport !== 'stdio' && transport !== 'http') {
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

// Pass raw CLI argument; main() handles defaults and normalization
main(process.argv[2]);
