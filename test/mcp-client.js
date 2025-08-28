import {TEST_CONFIG} from './test-config.js';

export class MCPClient {
	constructor(serverProcess, {quiet = false} = {}) {
		this.serverProcess = serverProcess;
		this.messageId = 0;
		this.pendingRequests = new Map();
		this.tools = new Map();
		this.initialized = false;
		this.buffer = ''; // Buffer for incomplete messages
		this.quiet = quiet;
	}

	// Send a message to the server
	sendMessage(method, params = {}) {
		const id = ++this.messageId;
		const message = {jsonrpc: '2.0', id, method, params};
		const messageStr = JSON.stringify(message) + '\n';
		this.serverProcess.stdin.write(messageStr);

		return new Promise((resolveRequest, reject) => {
			this.pendingRequests.set(id, {resolve: resolveRequest, reject});

			// Set timeout for request
			setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					reject(new Error(`Request timeout for ${method}`));
				}
			}, TEST_CONFIG.mcpServer.timeout);
		});
	}

	// Send a notification to the server (no response expected)
	sendNotification(method, params = {}) {
		const message = {jsonrpc: '2.0', method, params};
		const messageStr = JSON.stringify(message) + '\n';
		this.serverProcess.stdin.write(messageStr);
	}

	// Handle incoming messages from server
	handleServerMessage(data) {
		// Add incoming data to buffer
		this.buffer += data.toString();

		// Process complete lines from buffer
		const lines = this.buffer.split('\n');

		// Keep the last (potentially incomplete) line in buffer
		this.buffer = lines.pop() || '';

		for (const line of lines) {
			if (!line.trim()) {
				continue;
			}

			try {
				const message = JSON.parse(line);

				if (message.id !== undefined) {
					// This is a response to a request
					const pending = this.pendingRequests.get(message.id);
					if (pending) {
						this.pendingRequests.delete(message.id);
						if (message.error) {
							pending.reject(new Error(message.error.message || 'Unknown error'));
						} else {
							pending.resolve(message.result);
						}
					}
				} else if (message.method === 'notifications/message') {
					// Handle notification messages
					const level = message.params?.level || 'info';
					const text = message.params?.data || '';
					this.logNotification(level, text);
				}
			} catch (error) {
				// Only log parsing errors for non-empty lines
				if (line.trim()) {
					console.error(`${TEST_CONFIG.colors.red}Error parsing server message:${TEST_CONFIG.colors.reset}`, error);
					const truncatedLine = line.length > 300 ? line.substring(0, 300) + '...' : line;
					console.error('Raw message:', truncatedLine);
				}
			}
		}
	}

	// Log notification messages
	logNotification(level, text) {
		if (this.quiet) {
			return;
		}
		const color = {
			'emergency': TEST_CONFIG.colors.red,
			'alert': TEST_CONFIG.colors.red,
			'critical': TEST_CONFIG.colors.red,
			'error': TEST_CONFIG.colors.red,
			'warning': TEST_CONFIG.colors.yellow,
			'notice': TEST_CONFIG.colors.green,
			'info': TEST_CONFIG.colors.cyan,
			'debug': TEST_CONFIG.colors.pink
		}[level] || TEST_CONFIG.colors.reset;

		console.log(`${color}[${level.toUpperCase()}]${TEST_CONFIG.colors.reset} ${text}`);
	}

	// Initialize the MCP connection
	async initialize(clientConfig = {name: 'IBM Salesforce MCP Test Client', version: '1.0.0'}) {
		try {
			const result = await this.sendMessage('initialize', {
				protocolVersion: '2025-06-18',
				capabilities: {
					// sampling: {},
					// elicitation: {}
				},
				clientInfo: clientConfig
			});

			if (!this.quiet) {
				console.log(`${TEST_CONFIG.colors.green}✓ Server initialized${TEST_CONFIG.colors.reset}`);
				console.log(`  Protocol version: ${result.protocolVersion}`);
				console.log(`  Server: ${result.serverInfo.name} v${result.serverInfo.version}`);
				console.log(`  Client: ${clientConfig.name} v${clientConfig.version}`);
			}

			// Log server capabilities for debugging
			if (!this.quiet && result.capabilities) {
				console.log('  Server capabilities:');
				for (const [key, value] of Object.entries(result.capabilities)) {
					console.log(`    - ${key}: ${JSON.stringify(value)}`);
				}
			}

			// Send initialized notification to indicate client is ready
			await this.sendNotification('notifications/initialized');
			if (!this.quiet) {
				console.log(`${TEST_CONFIG.colors.blue}Sent initialized notification${TEST_CONFIG.colors.reset}`);
			}

			this.initialized = true;
			return result;

		} catch (error) {
			console.error(`${TEST_CONFIG.colors.red}Error initializing MCP connection:${TEST_CONFIG.colors.reset}`, error);
			throw error;
		}
	}

	// List available tools
	async listTools() {
		const result = await this.sendMessage('tools/list');

		if (!this.quiet) {
			console.log(`  Found ${result.tools.length} tools:`);
			for (const tool of result.tools) {
				console.log(`    - ${tool.name}`);
				this.tools.set(tool.name, tool);
			}
		} else {
			for (const tool of result.tools) {
				this.tools.set(tool.name, tool);
			}
		}

		return result.tools;
	}

	// Call a tool
	async callTool(name, arguments_ = {}) {
		if (!this.tools.has(name)) {
			throw new Error(`Tool '${name}' not found. Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
		}

		if (!this.quiet) {
			console.log(`${TEST_CONFIG.colors.blue}Calling tool "${name}" with arguments: ${JSON.stringify(arguments_)}${TEST_CONFIG.colors.reset}`);
		}

		const result = await this.sendMessage('tools/call', {
			name,
			arguments: arguments_
		});

		// Check if the tool returned an error
		if (result.isError) {
			const errorMessage = result.content?.[0]?.text || 'Unknown error';
			throw new Error(`Tool '${name}' returned error: ${errorMessage}`);
		}

		return result;
	}

	// Set logging level
	async setLoggingLevel(level = TEST_CONFIG.mcpServer.defaultLogLevel) {
		if (!this.quiet) {
			console.log(`${TEST_CONFIG.colors.blue}Setting logging level to "${level}"${TEST_CONFIG.colors.reset}`);
		}

		const result = await this.sendMessage('logging/setLevel', {level});

		if (!this.quiet) {
			console.log(`${TEST_CONFIG.colors.green}✓ Logging level set to: ${level}${TEST_CONFIG.colors.reset}`);
		}
		return result;
	}

	// Check if client is initialized
	isInitialized() {
		return this.initialized;
	}

	// Get available tools
	getAvailableTools() {
		return Array.from(this.tools.keys());
	}
}
