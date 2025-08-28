import {log} from './src/utils.js';
import {mcpServer, setupServer} from './src/mcp-server.js';

// Lightweight prepublish validation mode: load modules and exit
if (process.env.MCP_PREPUBLISH_VALIDATE === '1') {
	try {
		// Import a couple of key modules to ensure obfuscated ESM loads
		await import('./src/utils.js');
		await import('./src/mcp-server.js');

		//For prepublish validation in the publish script
		// eslint-disable-next-line no-console
		console.log('PREPUBLISH_OK');

		process.exit(0);
	} catch (e) {
		console.error('PREPUBLISH_FAIL');
		console.error(e?.stack || e?.message || String(e));
		process.exit(1);
	}
}

export async function main() {
	try {
		await setupServer();

	} catch (error) {
		log(error, 'error', 'Error starting IBM MCP Salesforce server');
		await mcpServer.close();
		process.exit(1);
	}
}

main();
