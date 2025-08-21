#!/usr/bin/env node

import {spawn, execSync} from 'child_process';
import {fileURLToPath} from 'url';
import {dirname, resolve} from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants
const TEST_ORG_ALIAS = 'DEVSERVICE'; // Canvia aquest valor per l'àlies de la teva org de test

// Colors for console output
const COLORS = {
	reset: '\x1b[0m', bright: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', orange: '\x1b[38;5;208m',
	blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m', pink: '\x1b[95m'
};

class MCPClient {
	constructor() {
		this.serverProcess = null;
		this.messageId = 0;
		this.pendingRequests = new Map();
		this.tools = new Map();
		this.initialized = false;
		this.buffer = ''; // Buffer for incomplete messages
	}

	// Start the MCP server process
	async startServer() {
		console.log(`${COLORS.blue}Starting MCP server...${COLORS.reset}`);

		this.serverProcess = spawn('node', [resolve(__dirname, '../index.js')], {
			stdio: ['pipe', 'pipe', 'pipe'],
			cwd: resolve(__dirname, '..')
		});

		// Set up communication
		this.serverProcess.stdout.on('data', (data) => {
			this.handleServerMessage(data.toString());
		});

		this.serverProcess.stderr.on('data', (data) => {
			console.error(`${COLORS.red}Server stderr:${COLORS.reset}`, data.toString());
		});

		this.serverProcess.on('error', (error) => {
			console.error(`${COLORS.red}Failed to start server:${COLORS.reset}`, error);
		});

		this.serverProcess.on('close', (code) => {
			console.log(`${COLORS.yellow}Server process exited with code ${code}${COLORS.reset}`);
		});

		// Wait a bit for server to start
		await new Promise(resolveTimeout => setTimeout(resolveTimeout, 1000));
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
			}, 30000); // 30 second timeout
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
			if (!line.trim()) { continue; }

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
					console.error(`${COLORS.red}Error parsing server message:${COLORS.reset}`, error);
					const truncatedLine = line.length > 300 ? line.substring(0, 300) + '...' : line;
					console.error('Raw message:', truncatedLine);
				}
			}
		}
	}

	// Log notification messages
	logNotification(level, text) {
		const color = {
			'emergency': COLORS.red,
			'alert': COLORS.red,
			'critical': COLORS.red,
			'error': COLORS.red,
			'warning': COLORS.yellow,
			'notice': COLORS.green,
			'info': COLORS.cyan,
			'debug': COLORS.pink
		}[level] || COLORS.reset;
		console.log(`${color}[${level.toUpperCase()}]${COLORS.reset} ${text}`);
	}

	// Initialize the MCP connection
	async initialize(clientConfig = {name: 'IBM Salesforce MCP Test Client', version: '1.0.0'}) {
		try {
			const result = await this.sendMessage('initialize', {
				protocolVersion: '2025-06-18',
				capabilities: {
					// roots: { listChanged: true },
					sampling: {},
					elicitation: {}
				},
				clientInfo: clientConfig
			});

			console.log(`${COLORS.green}✓ Server initialized${COLORS.reset}`);
			console.log(`  Protocol version: ${result.protocolVersion}`);
			console.log(`  Server: ${result.serverInfo.name} v${result.serverInfo.version}`);
			console.log(`  Client: ${clientConfig.name} v${clientConfig.version}`);

			// Log server capabilities for debugging
			if (result.capabilities) {
				console.log('  Server capabilities:');

				for (const [key, value] of Object.entries(result.capabilities)) {
					console.log(`    - ${key}: ${JSON.stringify(value)}`);
				}
			}

			// Send initialized notification to indicate client is ready
			await this.sendNotification('notifications/initialized');
			console.log(`${COLORS.blue}Sent initialized notification${COLORS.reset}`);

			this.initialized = true;
			return result;

		} catch (error) {
			console.error(`${COLORS.red}Error initializing MCP connection:${COLORS.reset}`, error);
			throw error;
		}
	}

	// List available tools
	async listTools() {
		console.log(`${COLORS.blue}Listing available tools...${COLORS.reset}`);

		const result = await this.sendMessage('tools/list');

		console.log(`${COLORS.green}✓ Found ${result.tools.length} tools:${COLORS.reset}`);
		for (const tool of result.tools) {
			console.log(`  - ${tool.name}`);
			this.tools.set(tool.name, tool);
		}

		return result.tools;
	}

	// Call a tool
	async callTool(name, arguments_ = {}) {
		if (!this.tools.has(name)) {
			throw new Error(`Tool '${name}' not found. Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
		}

		console.log(`${COLORS.blue}Calling tool "${name}" with arguments: ${JSON.stringify(arguments_)}${COLORS.reset}`);

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
	async setLoggingLevel(level) {
		console.log(`${COLORS.blue}Setting logging level to: ${level}${COLORS.reset}`);

		const result = await this.sendMessage('logging/setLevel', {
			level
		});

		console.log(`${COLORS.green}✓ Logging level set to: ${level}${COLORS.reset}`);
		return result;
	}

	// Stop the server
	async stopServer() {
		if (this.serverProcess) {
			console.log(`${COLORS.blue}Stopping MCP server...${COLORS.reset}`);
			this.serverProcess.kill();
			this.serverProcess = null;
		}
	}
}

// Org management utilities
class OrgManager {
	static getCurrentOrg() {
		try {
			const result = execSync('sf config get target-org --json', {encoding: 'utf8'}).result.alias || '';
			const config = JSON.parse(result);
			return config.result?.value || null;
		} catch (error) {
			console.error(`${COLORS.red}Error getting current org:${COLORS.reset}`, error.message);
			return null;
		}
	}

	static setTargetOrg(alias) {
		try {
			execSync(`sf config set target-org "${alias}" --global`, {encoding: 'utf8'});
			console.log(`${COLORS.green}✓ Switched to org: ${alias}${COLORS.reset}`);
			return true;
		} catch (error) {
			console.error(`${COLORS.red}Error switching to org ${alias}:${COLORS.reset}`, error.message);
			return false;
		}
	}

	static async ensureTestOrg() {
		const currentOrg = this.getCurrentOrg();
		console.log(`${COLORS.blue}Current org: ${currentOrg || 'none'}${COLORS.reset}`);
		console.log(`${COLORS.blue}Test org: ${TEST_ORG_ALIAS}${COLORS.reset}`);

		if (currentOrg === TEST_ORG_ALIAS) {
			console.log(`${COLORS.green}✓ Already in test org${COLORS.reset}`);
			return null; // No need to restore
		}

		console.log(`${COLORS.yellow}Switching to test org...${COLORS.reset}`);
		if (this.setTargetOrg(TEST_ORG_ALIAS)) {
			return currentOrg; // Return original org to restore later
		} else {
			throw new Error(`Failed to switch to test org: ${TEST_ORG_ALIAS}`);
		}
	}

	static restoreOriginalOrg(originalOrg) {
		if (!originalOrg) {
			console.log(`${COLORS.blue}No original org to restore${COLORS.reset}`);
			return;
		}

		console.log(`${COLORS.yellow}Restoring original org: ${originalOrg}${COLORS.reset}`);
		if (this.setTargetOrg(originalOrg)) {
			console.log(`${COLORS.green}✓ Restored original org${COLORS.reset}`);
		} else {
			console.error(`${COLORS.red}Failed to restore original org${COLORS.reset}`);
		}
	}
}

// Test runner
class MCPTestRunner {
	constructor() {
		this.client = new MCPClient();
		this.testResults = [];
		this.originalOrg = null;
		this.clientConfig = {name: 'IBM Salesforce MCP Test Client', version: '1.0.0'};
	}

	async runTest(name, testFunction) {
		console.log(`\n${COLORS.cyan}${'='.repeat(50)}${COLORS.reset}`);
		console.log(`${COLORS.orange}Running test: ${name}${COLORS.reset}`);
		console.log(`${COLORS.cyan}${'='.repeat(50)}${COLORS.reset}`);

		const startTime = Date.now();
		let success = false;
		let error = null;

		try {
			await testFunction();
			success = true;
		} catch (err) {
			error = err;
			console.error(`${COLORS.red}✗ Test failed:${COLORS.reset}`, err.message);
		}

		const duration = Date.now() - startTime;
		const status = success ? `${COLORS.green}✓ PASS${COLORS.reset}` : `${COLORS.red}✗ FAIL${COLORS.reset}`;

		console.log(`\n${status} ${name} (${duration}ms)`);

		this.testResults.push({
			name,
			success,
			duration,
			error: error?.message
		});

		return success;
	}

	async runAllTests() {

		try {
			// Ensure we're in the test org
			console.log(`${COLORS.orange}Managing Salesforce org...${COLORS.reset}`);
			this.originalOrg = await OrgManager.ensureTestOrg();

			// Start server
			console.log(`${COLORS.bright}Starting MCP Client Tests${COLORS.reset}\n\n`);
			await this.client.startServer();

			// Initialize connection
			console.log(`${COLORS.orange}Initializing MCP connection...${COLORS.reset}`);
			await this.runTest('Initialize MCP Connection', async () => {
				await this.client.initialize(this.clientConfig);
			});

			// List tools
			await this.runTest('List Available Tools', async () => {
				await this.client.listTools();
			});

			// Set logging level to info
			await this.runTest('Set Logging Level to Info', async () => {
				await this.client.setLoggingLevel('info');
			});

			// Test basic tools - commented out for now to focus on connection
			await this.runTest('Test getOrgAndUserDetails', async () => {
				await this.client.callTool('getOrgAndUserDetails', {});
				// console.log('Result:', JSON.stringify(result, null, 2));

			});

			// Wait for server to fully retrieve the org and user details
			await new Promise(resolveTimeout => setTimeout(resolveTimeout, 3000));

			await this.runTest('Test salesforceMcpUtils getState', async () => {
				await this.client.callTool('salesforceMcpUtils', {action: 'getState'});
				// console.log('Result:', JSON.stringify(result, null, 2));

			});

			await this.runTest('Test salesforceMcpUtils getCurrentDatetime', async () => {
				await this.client.callTool('salesforceMcpUtils', {action: 'getCurrentDatetime'});
				// console.log('Result:', JSON.stringify(result, null, 2));

			});

			await this.runTest('Test salesforceMcpUtils clearCache', async () => {
				await this.client.callTool('salesforceMcpUtils', {action: 'clearCache'});
				// console.log('Result:', JSON.stringify(result, null, 2));

			});

			await this.runTest('Test apexDebugLogs status', async () => {
				await this.client.callTool('apexDebugLogs', {action: 'status'});
				// console.log('Result:', JSON.stringify(result, null, 2));

			});

			await this.runTest('Test apexDebugLogs on', async () => {
				await this.client.callTool('apexDebugLogs', {action: 'on'});
				// console.log('Result:', JSON.stringify(result, null, 2));

			});

			await this.runTest('Test apexDebugLogs list', async () => {
				await this.client.callTool('apexDebugLogs', {action: 'list'});
				// console.log('Result:', JSON.stringify(result, null, 2));

			});

			await this.runTest('Test apexDebugLogs get', async () => {
				// First get a log ID from the list operation
				const listResult = await this.client.callTool('apexDebugLogs', {action: 'list'});
				if (listResult.structuredContent && listResult.structuredContent.length > 0) {
					const firstLog = listResult.structuredContent[0];
					await this.client.callTool('apexDebugLogs', {
						action: 'get',
						logId: firstLog.Id
					});
					// console.log('Result:', JSON.stringify(result, null, 2));

				} else {
					console.log('No logs available to test get operation');
				}
			});

			await this.runTest('Test apexDebugLogs off', async () => {
				await this.client.callTool('apexDebugLogs', {action: 'off'});
				// console.log('Result:', JSON.stringify(result, null, 2));

			});

			await this.runTest('Test describeObject Account', async () => {
				await this.client.callTool('describeObject', {
					sObjectName: 'Account',
					include: 'fields'
				});

			});

			await this.runTest('Test executeSoqlQuery', async () => {
				await this.client.callTool('executeSoqlQuery', {
					query: 'SELECT Id, Name FROM Account LIMIT 3'
				});
				// console.log('Result:', JSON.stringify(result, null, 2));

			});

			await this.runTest('Test getRecentlyViewedRecords', async () => {
				const result = await this.client.callTool('getRecentlyViewedRecords', {});
				// console.log('Result:', JSON.stringify(result, null, 2));
				return result; // Return result to use in next test
			});

			await this.runTest('Test getRecord', async () => {
				// Get a record ID from recently viewed records
				const recentlyViewed = await this.client.callTool('getRecentlyViewedRecords', {});
				if (recentlyViewed.records && recentlyViewed.records.length > 0) {
					const firstRecord = recentlyViewed.records[0];
					await this.client.callTool('getRecord', {
						sObjectName: firstRecord.SobjectType,
						recordId: firstRecord.Id
					});
					// console.log('Result:', JSON.stringify(result, null, 2));

				} else {
					// Fallback to a known Account ID if no recently viewed records
					await this.client.callTool('getRecord', {
						sObjectName: 'Account',
						recordId: '001KN00000Il3uUYAR'
					});
					// console.log('Result:', JSON.stringify(result, null, 2));
				}
			});

			await this.runTest('Test getApexClassCodeCoverage', async () => {
				await this.client.callTool('getApexClassCodeCoverage', {
					classNames: ['TestMCPTool']
				});
				// console.log('Result:', JSON.stringify(result, null, 2));
			});

		} finally {
			// Stop server
			await this.client.stopServer();

			// Restore original org
			if (this.originalOrg) {
				console.log(`${COLORS.orange}Restoring Salesforce org...${COLORS.reset}`);
				OrgManager.restoreOriginalOrg(this.originalOrg);
			}
		}

		// Print summary
		this.printSummary();
	}

	printSummary() {
		console.log(`\n${COLORS.cyan}${'='.repeat(50)}${COLORS.reset}`);
		console.log(`${COLORS.bright}Test Summary for Client: ${this.clientConfig.name} v${this.clientConfig.version}${COLORS.reset}`);
		console.log(`${COLORS.cyan}${'='.repeat(50)}${COLORS.reset}`);

		const total = this.testResults.length;
		const passed = this.testResults.filter(r => r.success).length;
		const failed = total - passed;

		console.log(`Total tests: ${total}`);
		console.log(`Passed: ${COLORS.green}${passed}${COLORS.reset}`);
		console.log(`Failed: ${COLORS.red}${failed}${COLORS.reset}`);

		if (failed > 0) {
			console.log(`\n${COLORS.red}Failed tests:${COLORS.reset}`);
			this.testResults
				.filter(r => !r.success)
				.forEach(r => console.log(`  - ${r.name}: ${r.error}`));
		}

		console.log(`\n${failed === 0 ? COLORS.green : COLORS.red}${failed === 0 ? 'All tests passed!' : 'Some tests failed!'}${COLORS.reset}`);
	}
}

// Main execution
async function main() {
	// Definim els diferents clients a provar
	const clientConfigs = [
		{
			name: 'Visual Studio Code',
			version: '1.104.0'
		},
		{
			name: 'cursor-vscode',
			version: '1.0.0'
		},
		{
			name: 'IBM Salesforce MCP Test Client',
			version: '1.0.0'
		}
	];

	// Executem les proves per cada client
	for (const clientConfig of clientConfigs) {
		console.log(`\n\n${COLORS.bright}${COLORS.magenta}${'='.repeat(80)}${COLORS.reset}`);
		console.log(`${COLORS.bright}${COLORS.magenta}Executant proves amb client: ${clientConfig.name} v${clientConfig.version}${COLORS.reset}`);
		console.log(`${COLORS.bright}${COLORS.magenta}${'='.repeat(80)}${COLORS.reset}\n`);

		const runner = new MCPTestRunner();
		runner.clientConfig = clientConfig; // Guardem la configuració del client per utilitzar-la després

		try {
			await runner.runAllTests();
		} catch (error) {
			console.error(`${COLORS.red}Fatal error amb client ${clientConfig.name}:${COLORS.reset}`, error);
		}

		// Esperem un moment abans de començar amb el següent client
		console.log(`\n${COLORS.gray}Esperant abans d'iniciar el següent test...${COLORS.reset}`);
		await new Promise(resolve => setTimeout(resolve, 3000));
	}
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export {MCPClient, MCPTestRunner};
