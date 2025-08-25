#!/usr/bin/env node

import {MCPServerManager, SalesforceOrgManager, TestHelpers} from './helpers.js';
import {MCPClient} from './mcp-client.js';
import {MCPToolsTestSuite} from './suites/mcp-tools.js';
import {TEST_CONFIG} from './config.js';

// Test runner class
class TestRunner {
	constructor() {
		this.serverManager = new MCPServerManager();
		this.mcpClient = null;
		this.testResults = [];
		this.originalOrg = null;
	}

	// Run a single test
	async runTest(name, testFunction) {
		const timestamp = new Date().toISOString().slice(11, 23);
		console.log(`\n\n${TEST_CONFIG.colors.cyan}${'='.repeat(80)}${TEST_CONFIG.colors.reset}`);
		console.log(`${TEST_CONFIG.colors.orange}[${timestamp}] Running test: ${name}${TEST_CONFIG.colors.reset}`);
		console.log(`${TEST_CONFIG.colors.cyan}${'='.repeat(80)}${TEST_CONFIG.colors.reset}`);

		const startTime = Date.now();
		let success = false;
		let error = null;

		try {
			await testFunction();
			success = true;
		} catch (err) {
			error = err;
			console.error(`${TEST_CONFIG.colors.red}✗ Test failed:${TEST_CONFIG.colors.reset}`, err.message);
		}

		const duration = TestHelpers.formatDuration(startTime);
		const status = TestHelpers.getTestStatus(success);

		// Return test result info instead of immediately showing it
		const testResult = {
			name,
			success,
			duration,
			error: error?.message,
			status,
			startTime
		};

		this.testResults.push(testResult);

		return testResult;
	}

	// Display test result (separated from runTest for better control)
	displayTestResult(testResult) {
		console.log(`\n${TEST_CONFIG.colors.cyan}${'─'.repeat(40)}${TEST_CONFIG.colors.reset}`);
		console.log(`${testResult.status} ${testResult.name} (${testResult.duration}ms)`);
		console.log(`${TEST_CONFIG.colors.cyan}${'─'.repeat(40)}${TEST_CONFIG.colors.reset}`);
	}

	// Run MCP tools tests
	async runMCPToolsTests(testsToRun = null) {
		const mcpToolsSuite = new MCPToolsTestSuite(this.mcpClient);
		const testsToExecute = await mcpToolsSuite.runTests(testsToRun);

		for (let i = 0; i < testsToExecute.length; i++) {
			const test = testsToExecute[i];

			// Run the test through the TestRunner for proper tracking
			let result;
			const testResult = await this.runTest(`Test ${test.name}`, async () => {
			// Execute the test and get the result INSIDE runTest so title appears first
				try {
					result = await test.run(mcpToolsSuite.context);
					return result;
				} catch (error) {
					console.log(`${TEST_CONFIG.colors.red}❌ Test ${test.name} failed: ${error.message}${TEST_CONFIG.colors.reset}`);
					throw error;
				}
			});

			// Display tool output AFTER the test execution
			mcpToolsSuite.displayToolOutput(test.name, result);

			// Execute post-test script if it exists
			if (test.script) {
				try {
					console.log(`${TEST_CONFIG.colors.cyan}Executing post-test script for ${test.name}...${TEST_CONFIG.colors.reset}`);
					await test.script(result, mcpToolsSuite.context);
				} catch (scriptError) {
					console.log(`${TEST_CONFIG.colors.red}❌ Script execution failed for ${test.name}: ${scriptError.message}${TEST_CONFIG.colors.reset}`);
				}
			}

			// Display test result AFTER everything else
			this.displayTestResult(testResult);

			// Apply delay if specified (after the test has been fully processed by TestRunner)
			if ((test.thenWait || 0) > 0) {
				console.log(`\n${TEST_CONFIG.colors.cyan}Wait for ${Math.ceil(test.thenWait / 1000)}s after test "${test.name}"...${TEST_CONFIG.colors.reset}`);
				const delayStart = Date.now();

				// Show countdown during delay
				const updateInterval = 1000; // Update every 1 second
				const countdownInterval = setInterval(() => {
					const elapsed = Date.now() - delayStart;
					const remaining = Math.max(0, test.thenWait - elapsed);

					if (remaining > 0) {
						process.stdout.write(`\r${TEST_CONFIG.colors.blue}${Math.ceil(remaining / 1000)}s remaining...${TEST_CONFIG.colors.reset}`);
					}
				}, updateInterval);

				// Wait for the delay to complete
				await new Promise(resolve => setTimeout(resolve, test.thenWait));

				// Clear interval and show completion
				clearInterval(countdownInterval);
				process.stdout.write('\r' + ' '.repeat(50) + '\r'); // Clear the countdown line

				console.log('    Finished waiting.');
			}
		}
	}

	// Run all tests
	async runAllTests(options = {}) {
		const {tests} = options;

		try {
			// Ensure we're in the test org
			console.log(`\n${TEST_CONFIG.colors.cyan}Managing Salesforce org...${TEST_CONFIG.colors.reset}`);
			this.originalOrg = await SalesforceOrgManager.ensureTestOrg();

			// Start server
			await this.serverManager.start();

			// Wait for server to fully start
			await new Promise(resolveTimeout => setTimeout(resolveTimeout, TEST_CONFIG.mcpServer.startupDelay));

			// Create MCP client and set up communication
			this.mcpClient = new MCPClient(this.serverManager.getProcess());

			// Set up stdout handling for the client
			this.serverManager.getProcess().stdout.on('data', (data) => {
				this.mcpClient.handleServerMessage(data);
			});

			// Set the MCP server logging level
			await this.mcpClient.setLoggingLevel(TEST_CONFIG.mcpServer.defaultLogLevel);

			// Execute MCP tools tests
			await this.runMCPToolsTests(tests);

			// Wait for any pending operations
			await new Promise(resolveTimeout => setTimeout(resolveTimeout, 1000));

		} finally {
			// Stop server
			await this.serverManager.stop();

			// Restore original org
			if (this.originalOrg) {
				console.log(`${TEST_CONFIG.colors.orange}Restoring Salesforce org...${TEST_CONFIG.colors.reset}`);
				SalesforceOrgManager.restoreOriginalOrg(this.originalOrg);
			}
		}

		// Print summary
		this.printSummary();
	}

	// Print test summary
	printSummary() {
		console.log(`\n${TEST_CONFIG.colors.cyan}${'='.repeat(60)}${TEST_CONFIG.colors.reset}`);
		console.log(`${TEST_CONFIG.colors.bright}🏁 FINAL TEST SUMMARY 🏁${TEST_CONFIG.colors.reset}`);
		console.log(`${TEST_CONFIG.colors.cyan}${'='.repeat(60)}${TEST_CONFIG.colors.reset}`);

		const total = this.testResults.length;
		const passed = this.testResults.filter(r => r.success).length;
		const failed = total - passed;

		console.log(`📊 Total tests: ${TEST_CONFIG.colors.bright}${total}${TEST_CONFIG.colors.reset}`);
		console.log(`✅ Passed: ${TEST_CONFIG.colors.green}${passed}${TEST_CONFIG.colors.reset}`);
		console.log(`❌ Failed: ${TEST_CONFIG.colors.red}${failed}${TEST_CONFIG.colors.reset}`);

		if (failed > 0) {
			console.log(`\n${TEST_CONFIG.colors.red}❌ Failed tests:${TEST_CONFIG.colors.reset}`);
			this.testResults
				.filter(r => !r.success)
				.forEach(r => console.log(`  🔴 ${r.name}: ${r.error}`));
		}

		console.log(`\n${failed === 0 ? TEST_CONFIG.colors.green : TEST_CONFIG.colors.red}${failed === 0 ? '🎉 All tests passed! 🎉' : '💥 Some tests failed! 💥'}${TEST_CONFIG.colors.reset}`);
		console.log(`${TEST_CONFIG.colors.cyan}${'='.repeat(60)}${TEST_CONFIG.colors.reset}`);
	}
}

// Main execution function
async function main() {
	const cmdArgs = TestHelpers.parseCommandLineArgs();
	const LOG_LEVEL = cmdArgs.logLevel || TEST_CONFIG.mcpServer.defaultLogLevel;
	const TESTS_TO_RUN = cmdArgs.tests ? cmdArgs.tests.split(',').map(test => test.trim()) : null;

	// Show tests to run if specified
	if (TESTS_TO_RUN) {
		console.log(`${TEST_CONFIG.colors.cyan}Selected tests to run: ${TESTS_TO_RUN.join(', ')} using log level: ${LOG_LEVEL}${TEST_CONFIG.colors.reset}`);
	} else {
		console.log(`${TEST_CONFIG.colors.cyan}Running all available tests using log level: ${LOG_LEVEL}${TEST_CONFIG.colors.reset}`);
	}

	// Run tests
	const runner = new TestRunner();
	try {
		await runner.runAllTests({
			tests: TESTS_TO_RUN,
			logLevel: LOG_LEVEL
		});
	} catch (error) {
		console.error(`${TEST_CONFIG.colors.red}Fatal error:${TEST_CONFIG.colors.reset}`, error);
		process.exit(1);
	}
}

// Show help if requested
function showHelp() {
	console.log(`
${TEST_CONFIG.colors.bright}IBM Salesforce MCP Test Runner${TEST_CONFIG.colors.reset}

${TEST_CONFIG.colors.cyan}Usage:${TEST_CONFIG.colors.reset}
  node test/runner.js [options]

${TEST_CONFIG.colors.cyan}Options:${TEST_CONFIG.colors.reset}
  	--logLevel=<level>  Set the logging level (default: ${TEST_CONFIG.mcpServer.defaultLogLevel})
                    Valid values: emergency, alert, critical, error, warning, notice, info, debug
  --tests=<tests>     Comma-separated list of test names to run (partial matching)
                    Example: "apexDebugLogs,getRecord"
  --help              Show this help message

${TEST_CONFIG.colors.cyan}Examples:${TEST_CONFIG.colors.reset}
  node test/runner.js --logLevel=debug
  node test/runner.js --tests=apexDebugLogs,getRecord
  node test/runner.js --logLevel=debug --tests=salesforceMcpUtils
`);
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const cmdArgs = TestHelpers.parseCommandLineArgs();

	if (cmdArgs.help) {
		showHelp();
	} else {
		main();
	}
}

export {TestRunner};
