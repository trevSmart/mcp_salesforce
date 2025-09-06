import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {createLogger} from './src/lib/logger.js';
import {mcpServer, setupServer, markServerReady} from './src/mcp-server.js';

const logger = createLogger();

async function start() {
	try {
		// Set up server without connecting to a transport
		await setupServer(null);

		const transports = new Map();

		const server = createServer(async (req, res) => {
			if (req.url !== '/mcp') {
				res.statusCode = 404;
				res.end('Not Found');
				return;
			}

			try {
				if (req.method === 'POST') {
					const sessionId = req.headers['mcp-session-id'];
					let transport = sessionId ? transports.get(sessionId) : undefined;

					if (!transport) {
						// Create new transport for initialization request
						transport = new StreamableHTTPServerTransport({
							sessionIdGenerator: () => randomUUID(),
							onsessioninitialized: (id) => transports.set(id, transport),
							onsessionclosed: (id) => transports.delete(id)
						});

						await mcpServer.connect(transport);
						markServerReady();
					}

					await transport.handleRequest(req, res);
				} else if (req.method === 'GET') {
					const sessionId = req.headers['mcp-session-id'];
					const transport = sessionId && transports.get(sessionId);
					if (!transport) {
						res.statusCode = 400;
						res.end('Invalid or missing session ID');
						return;
					}
					await transport.handleRequest(req, res);
				} else {
					res.statusCode = 405;
					res.end('Method Not Allowed');
				}
			} catch (error) {
				logger.error(error, 'Error handling MCP request');
				if (!res.headersSent) {
					res.statusCode = 500;
					res.end('Internal Server Error');
				}
			}
		});

		const port = Number.parseInt(process.env.MCP_HTTP_PORT || '3000', 10);
		server.listen(port, () => {
			logger.info(`MCP HTTP server listening on port ${port}`);
		});
	} catch (error) {
		logger.error(error, 'Error starting HTTP MCP server');
		await mcpServer.close();
		process.exit(1);
	}
}

start();
