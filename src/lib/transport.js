// Dynamic imports are used here to avoid loading transport-specific modules
// unless they're needed. This keeps stdio sessions lightweight by skipping
// Express/crypto and avoids pulling in the stdio transport when running over
// HTTP.

/**
 * Connects the provided MCP server to the requested transport.
 * Handlers should be registered on the server before this function is called.
 *
 * @param {McpServer} mcpServer - The MCP server instance to connect
 * @param {'stdio'|'http'} transportType - Type of transport to connect
 */
export async function connectTransport(mcpServer, transportType) {
	switch (transportType) {
		case 'stdio': {
			const {StdioServerTransport} = await import('@modelcontextprotocol/sdk/server/stdio.js');
			await mcpServer.connect(new StdioServerTransport()).then(() => new Promise((r) => setTimeout(r, 400)));
			return;
		}
		case 'http': {
			const express = (await import('express')).default;
			const {randomUUID} = await import('node:crypto');
			const {StreamableHTTPServerTransport} = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
			const {isInitializeRequest} = await import('@modelcontextprotocol/sdk/types.js');

			const app = express();
			app.use(express.json());

			const transports = {};

			app.post('/mcp', async (req, res) => {
				const sessionId = req.headers['mcp-session-id'];
				let transport;

				if (sessionId && transports[sessionId]) {
					transport = transports[sessionId];
				} else if (!sessionId && isInitializeRequest(req.body)) {
					transport = new StreamableHTTPServerTransport({
						sessionIdGenerator: () => randomUUID(),
						onsessioninitialized: (sid) => {
							transports[sid] = transport;
						}
					});

					transport.onclose = () => {
						if (transport.sessionId) {
							delete transports[transport.sessionId];
						}
					};

					await mcpServer.connect(transport);
				} else {
					res.status(400).json({
						jsonrpc: '2.0',
						error: {
							code: -32000,
							message: 'Bad Request: No valid session ID provided'
						},
						id: null
					});
					return;
				}

				await transport.handleRequest(req, res, req.body);
			});

			const handleSessionRequest = async (req, res) => {
				const sessionId = req.headers['mcp-session-id'];
				if (!(sessionId && transports[sessionId])) {
					res.status(400).send('Invalid or missing session ID');
					return;
				}

				const transport = transports[sessionId];
				await transport.handleRequest(req, res);
			};

			app.get('/mcp', handleSessionRequest);
			app.delete('/mcp', handleSessionRequest);

			const port = process.env.MCP_HTTP_PORT || 3000;
			app.listen(port);
			return;
		}
		default:
			throw new Error(`Unsupported transport type: ${transportType}`);
	}
}

export default connectTransport;
