#!/usr/bin/env node

import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
// @ts-expect-error
import {TestMcpClient} from 'ibm-test-mcp-client';
import {salesforceOrgManager, testHelpers} from './helpers.js';
import {SalesforceMcpTestSuite} from './suites/mcp-tools.js';
import {TEST_CONFIG} from './test-config.js';

// Test runner class
class TestRunner {
	constructor({compact = false, quiet = false} = {}) {
		this.mcpClient = null;
		this.testResults = [];
		this.originalOrg = null;
		this.compact = compact;
		this.quiet = quiet;
		this.startTime = null;
	}

	// Run a single test
	async runTest(name, testFunction) {
		const timestamp = new Date().toISOString().slice(11, 23);
		if (!this.quiet) {
			console.log(`\n\n${TEST_CONFIG.colors.cyan}${'='.repeat(80)}${TEST_CONFIG.colors.reset}`);
			console.log(`${TEST_CONFIG.colors.orange}[${timestamp}] Running test: ${name}${TEST_CONFIG.colors.reset}`);
			console.log(`${TEST_CONFIG.colors.cyan}${'='.repeat(80)}${TEST_CONFIG.colors.reset}`);
		}

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

		const duration = testHelpers.formatDuration(startTime);
		const status = testHelpers.getTestStatus(success);

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
		if (this.quiet) {
			console.log(`  Test ${TEST_CONFIG.colors.cyan}${testResult.name}${TEST_CONFIG.colors.reset}: ${testResult.status} ${TEST_CONFIG.colors.gray}(${testResult.duration})${TEST_CONFIG.colors.reset}`);
			return;
		}
		console.log(`\n${TEST_CONFIG.colors.cyan}${'─'.repeat(40)}${TEST_CONFIG.colors.reset}`);
		console.log(`${testResult.status} ${testResult.name} (${testResult.duration})`);
		console.log(`${TEST_CONFIG.colors.cyan}${'─'.repeat(40)}${TEST_CONFIG.colors.reset}`);
	}

	// Run test suite
	async runSuiteTests(testsToRun = null) {
		const suppressToolOutput = this.compact || this.quiet;
		const suite = new SalesforceMcpTestSuite(this.mcpClient, suppressToolOutput);

		// Global pre-suite hook (optional)
		if (typeof suite.scriptBeforeAll === 'function') {
			try {
				if (!this.quiet) {
					console.log(`${TEST_CONFIG.colors.cyan}Executing global pre-suite script...${TEST_CONFIG.colors.reset}`);
				}
				await suite.scriptBeforeAll(suite.context);
				if (!this.quiet) {
					console.log(`  ${TEST_CONFIG.colors.green}✓ Successfully executed global pre-suite script${TEST_CONFIG.colors.reset}`);
				}
			} catch (e) {
				console.log(`${TEST_CONFIG.colors.red}❌ Global pre-suite script failed: ${e.message}\n${TEST_CONFIG.colors.reset}`);
			}
		}

		const testData = await suite.runTests(testsToRun);

		// Run using a dependency-aware queue scheduler (no phases)
		await this.runTestsWithDependencies(testData.tests, suite);

		// Global post-suite hook (optional)
		if (typeof suite.scriptAfterAll === 'function') {
			try {
				if (!this.quiet) {
					console.log(`${TEST_CONFIG.colors.cyan}Executing global post-suite script...${TEST_CONFIG.colors.reset}`);
				}
				await suite.scriptAfterAll(suite.context);
			} catch (e) {
				console.log(`${TEST_CONFIG.colors.red}❌ Global post-suite script failed: ${e.message}\n${TEST_CONFIG.colors.reset}`);
			}
		}
	}

	// Dependency-aware scheduler
	async runTestsWithDependencies(tests, mcpToolsSuite) {
		const maxConcurrency = 7;
		// const nameToTest = new Map(tests.map(t => [t.name, t]));
		const dependents = new Map();
		const depCount = new Map();
		const started = new Set();
		const completed = new Set();
		const running = new Set();

		// Build dependency graph
		for (const test of tests) {
			depCount.set(test.name, (test.dependencies || []).length);
			for (const dep of test.dependencies || []) {
				if (!dependents.has(dep)) {
					dependents.set(dep, []);
				}
				dependents.get(dep).push(test.name);
			}
		}

		const ready = () => tests.filter((t) => !started.has(t.name) && (depCount.get(t.name) || 0) === 0);
		const delay = (ms) => new Promise((r) => setTimeout(r, ms));

		const runAndTrack = async (test) => {
			running.add(test.name);
			try {
				await this.runSingleTest(test, mcpToolsSuite);
				completed.add(test.name);
				// Decrement dependents depCount
				const deps = dependents.get(test.name) || [];
				for (const depName of deps) {
					depCount.set(depName, (depCount.get(depName) || 0) - 1);
				}
			} finally {
				running.delete(test.name);
			}
		};

		while (completed.size < tests.length) {
			let candidates = ready();

			if (candidates.length === 0 && running.size === 0) {
				const remaining = tests.filter((t) => !completed.has(t.name));
				throw new Error(`No runnable tests. Possible circular dependency among: ${remaining.map((t) => t.name).join(', ')}`);
			}

			// Prioritize high-priority tests
			const highPriority = candidates.filter((t) => t.priority === 'high');
			const regular = candidates.filter((t) => t.priority !== 'high');
			candidates = [...highPriority, ...regular];

			// If any exclusive test is ready, run it alone (prefer high-priority exclusives)
			const exclusive = candidates.find((t) => t.priority === 'high' && t.required);
			if (exclusive) {
				// Wait for current running tests to finish
				while (running.size > 0) {
					await delay(100);
				}
				started.add(exclusive.name);
				await runAndTrack(exclusive);
				continue; // re-evaluate
			}

			// Start as many parallelizable tests as possible
			let startedAny = false;
			for (const t of candidates) {
				if (running.size >= maxConcurrency) {
					break;
				}
				started.add(t.name);
				startedAny = true;
				// Fire and forget; scheduler will poll
				runAndTrack(t);
			}

			// If nothing started, wait for progress
			if (!startedAny) {
				await delay(100);
			}
		}
	}

	// Run a single test with all the TestRunner logic
	async runSingleTest(test, suite) {
		// Run the test through the TestRunner for proper tracking
		let result;
		// Execute pre-test script if present
		if (test.scriptBefore) {
			try {
				if (!this.quiet) {
					console.log(`${TEST_CONFIG.colors.cyan}Executing pre-test script for ${test.name}...${TEST_CONFIG.colors.reset}`);
				}
				await test.scriptBefore(suite.context);
			} catch (scriptError) {
				console.log(`${TEST_CONFIG.colors.red}❌ Pre-test script failed for ${test.name}: ${scriptError.message}\n${TEST_CONFIG.colors.reset}`);
			}
		}

		const testResult = await this.runTest(`${test.name}`, async () => {
			try {
				result = await test.run(suite.context);
				return result;
			} catch (error) {
				console.log(`${TEST_CONFIG.colors.red}❌ Test ${test.name} failed: ${error.message}${TEST_CONFIG.colors.reset}`);
				throw error;
			}
		});

		// Display tool output AFTER the test execution
		suite.displayToolOutput(test.name, result);

		// Execute post-test script if it exists
		if (test.scriptAfter) {
			try {
				if (!this.quiet) {
					console.log(`${TEST_CONFIG.colors.cyan}Executing post-test script for ${test.name}...${TEST_CONFIG.colors.reset}`);
				}
				await test.scriptAfter(result, suite.context);
			} catch (scriptError) {
				console.log(`${TEST_CONFIG.colors.red}❌ Script execution failed for ${test.name}: ${scriptError.message}${TEST_CONFIG.colors.reset}`);
			}
		}

		// Display test result AFTER everything else
		this.displayTestResult(testResult);

		// Apply delay if specified (after the test has been fully processed by TestRunner)
		if ((test.thenWait || 0) > 0) {
			if (this.quiet) {
				await new Promise((resolveTimeout) => setTimeout(resolveTimeout, test.thenWait));
			} else {
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
				await new Promise((resolveTimeout) => setTimeout(resolveTimeout, test.thenWait));

				// Clear interval and show completion
				clearInterval(countdownInterval);
				process.stdout.write(`\r${' '.repeat(50)}\r`); // Clear the countdown line

				console.log('    Finished waiting.');
			}
		}

		return testResult;
	}

	// Run tests in parallel with limited concurrency
	async runTestsInParallel(tests, mcpToolsSuite) {
		const maxConcurrency = 7; // Limit concurrent tests to avoid overwhelming Salesforce
		const testResults = new Map();
		const runningTests = new Set();

		// Helper function to run a single test
		const runTestWithTracking = async (test) => {
			try {
				const result = await this.runSingleTest(test, mcpToolsSuite);
				testResults.set(test.name, result);
			} catch (error) {
				testResults.set(test.name, {error: error.message});
			} finally {
				runningTests.delete(test);
			}
		};

		// Process tests with limited concurrency
		for (const test of tests) {
			// Wait if we've reached max concurrency
			while (runningTests.size >= maxConcurrency) {
				await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 100)); // Small delay
			}

			// Start the test
			runningTests.add(test);
			runTestWithTracking(test);
		}

		// Wait for all remaining tests to complete
		while (runningTests.size > 0) {
			await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 100));
		}

		// Return results in the same order as input
		return tests.map((test) => testResults.get(test.name));
	}

	// Run all tests
	async runAllTests(options = {}) {
		const {tests, logLevel} = options;

		// Record start time for total execution time calculation
		this.startTime = Date.now();

		try {
			// Ensure we're in the test org
			if (!this.quiet) {
				console.log(`\n${TEST_CONFIG.colors.cyan}Managing Salesforce org...${TEST_CONFIG.colors.reset}`);
			}
			this.originalOrg = await salesforceOrgManager.ensureTestOrg(this.quiet);

			// Ensure test runs never create real GitHub issues via webhook
			if (typeof process.env.MCP_REPORT_ISSUE_DRY_RUN === 'undefined') {
				process.env.MCP_REPORT_ISSUE_DRY_RUN = 'true';
			}

			// Resolve server target to use with TestMcpClient
			const __filename = fileURLToPath(import.meta.url);
			const __dirname = dirname(__filename);
			const defaultServerPath = resolve(__dirname, TEST_CONFIG.mcpServer.serverPath);

			// Helper: parse server args from env (JSON array or space-separated)
			const parseServerArgs = () => {
				// Allow overriding via CLI: --serverArgs="--stdio --flag value" or JSON array
				const raw = process.env.MCP_TEST_SERVER_ARGS;
				if (!raw) {
					return ['--stdio'];
				}
				try {
					const parsed = JSON.parse(raw);
					return Array.isArray(parsed) ? parsed : ['--stdio'];
				} catch {
					return raw.split(/\s+/).filter(Boolean);
				}
			};

			// Helper: parse a spec like "npx:@scope/pkg@ver#bin" or a .js/.py path
			const parseServerSpec = (raw, serverArgs) => {
				if (!raw) {
					return null;
				}
				if (raw.startsWith('npx:')) {
					const spec = raw.slice('npx:'.length);
					const [pkgAndVer, bin] = spec.split('#');
					const atIdx = pkgAndVer.lastIndexOf('@');
					let pkg = pkgAndVer;
					let version;
					if (atIdx > 0 && pkgAndVer.slice(atIdx - 1, atIdx) !== '/') {
						pkg = pkgAndVer.slice(0, atIdx);
						version = pkgAndVer.slice(atIdx + 1);
					}
					return {
						kind: 'npx',
						pkg,
						version,
						bin: bin || undefined,
						args: serverArgs,
						npxArgs: ['-y']
					};
				}
				const isPy = raw.endsWith('.py');
				const isJs = raw.endsWith('.js');
				if (!(isPy || isJs)) {
					throw new Error('MCP_TEST_SERVER_SPEC must be npx:... or a .js/.py path');
				}
				return {
					kind: 'script',
					interpreter: isPy ? 'python' : 'node',
					path: raw,
					args: serverArgs
				};
			};

			const serverArgs = parseServerArgs();

			// Priority 1: explicit spec via env (e.g., npx:@scope/pkg@ver#bin)
			let target = null;
			if (process.env.MCP_TEST_SERVER_SPEC) {
				target = parseServerSpec(process.env.MCP_TEST_SERVER_SPEC, serverArgs);
			}

			// Priority 2: explicit NPX env triplet (__MCP_NPX_PKG/VER/BIN)
			if (!target && process.env.__MCP_NPX_PKG) {
				target = {
					kind: 'npx',
					pkg: process.env.__MCP_NPX_PKG,
					version: process.env.__MCP_NPX_VER || undefined,
					bin: process.env.__MCP_NPX_BIN || undefined,
					args: serverArgs,
					npxArgs: ['-y']
				};
			}

			// Fallback: local script path (default behavior)
			if (!target) {
				const path = process.env.MCP_TEST_SERVER_PATH || defaultServerPath;
				target = {
					kind: 'script',
					interpreter: 'node',
					path,
					args: serverArgs
				};
			}

			// Ensure the spawned server starts at the requested log level
			const requestedLevel = logLevel || TEST_CONFIG.mcpServer.defaultLogLevel;
			const effectiveLevel = this.quiet ? 'warning' : requestedLevel;
			process.env.LOG_LEVEL = effectiveLevel;
			// Respect existing WORKSPACE_FOLDER_PATHS if provided; otherwise default to repo root
			if (!process.env.WORKSPACE_FOLDER_PATHS) {
				process.env.WORKSPACE_FOLDER_PATHS = resolve(__dirname, '..');
			}

			this.mcpClient = new TestMcpClient();
			await this.mcpClient.connect(target);

			// Set the MCP server logging level (quiet mode forces 'warning') after init as well
			if (this.quiet) {
				console.log(`${TEST_CONFIG.colors.gray}Running tests in quiet mode (log level set to "warning")${TEST_CONFIG.colors.reset}\n`);
			}
			await this.mcpClient.setLoggingLevel(effectiveLevel);

			// Execute tests
			await this.runSuiteTests(tests);

			// Wait for any pending operations
			await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 1000));
		} finally {
			// Disconnect MCP client and stop spawned server
			if (this.mcpClient) {
				if (!this.quiet) {
					console.log(`${TEST_CONFIG.colors.cyan}Stopping MCP server...${TEST_CONFIG.colors.reset}`);
				}
				await this.mcpClient.disconnect();
			}

			// Restore original org
			if (this.originalOrg) {
				if (!this.quiet) {
					console.log(`${TEST_CONFIG.colors.orange}Restoring Salesforce org...${TEST_CONFIG.colors.reset}`);
				}
				salesforceOrgManager.restoreOriginalOrg(this.originalOrg, this.quiet);
			}
		}

		// Print summary (in quiet mode, print only the final outcome line)
		if (!this.quiet) {
			this.printSummary();
		} else {
			const total = this.testResults.length;
			const passed = this.testResults.filter((r) => r.success).length;
			const failed = total - passed;
			console.log(`${failed === 0 ? '🎉 All tests passed! 🎉' : '💥 Some tests failed! 💥'}`);
		}

		// Show total execution time
		const formattedTotalTime = testHelpers.formatDuration(this.startTime);

		if (!this.quiet) {
			console.log(`\n${TEST_CONFIG.colors.cyan}${'─'.repeat(40)}${TEST_CONFIG.colors.reset}`);
			console.log(`${TEST_CONFIG.colors.bright}⏱️  Total execution time: ${formattedTotalTime}${TEST_CONFIG.colors.reset}`);
			console.log(`${TEST_CONFIG.colors.cyan}${'─'.repeat(40)}${TEST_CONFIG.colors.reset}`);
		} else {
			console.log(`⏱️  Total time: ${formattedTotalTime}`);
		}

		// Ensure clean exit
		if (!this.quiet) {
			console.log(`${TEST_CONFIG.colors.cyan}Test execution completed successfully.${TEST_CONFIG.colors.reset}`);
		}
		process.exit(0);
	}

	// Print test summary
	printSummary() {
		console.log(`\n${TEST_CONFIG.colors.cyan}${'='.repeat(60)}${TEST_CONFIG.colors.reset}`);
		console.log(`${TEST_CONFIG.colors.bright}🏁 FINAL TEST SUMMARY 🏁${TEST_CONFIG.colors.reset}`);
		console.log(`${TEST_CONFIG.colors.cyan}${'='.repeat(60)}${TEST_CONFIG.colors.reset}`);

		const total = this.testResults.length;
		const passed = this.testResults.filter((r) => r.success).length;
		const failed = total - passed;

		console.log(`📊 Total tests: ${TEST_CONFIG.colors.bright}${total}${TEST_CONFIG.colors.reset}`);
		console.log(`✅ Passed: ${TEST_CONFIG.colors.green}${passed}${TEST_CONFIG.colors.reset}`);
		console.log(`❌ Failed: ${TEST_CONFIG.colors.red}${failed}${TEST_CONFIG.colors.reset}`);

		if (failed > 0) {
			console.log(`\n${TEST_CONFIG.colors.red}❌ Failed tests:${TEST_CONFIG.colors.reset}`);
			for (const r of this.testResults.filter((r) => !r.success)) {
				console.log(`  🔴 ${r.name}: ${r.error}`);
			}
		}

		console.log(`\n${failed === 0 ? TEST_CONFIG.colors.green : TEST_CONFIG.colors.red}${failed === 0 ? '🎉 All tests passed! 🎉' : '💥 Some tests failed! 💥'}${TEST_CONFIG.colors.reset}`);
		console.log(`${TEST_CONFIG.colors.cyan}${'='.repeat(60)}${TEST_CONFIG.colors.reset}`);
	}
}

// Show test plan without executing tests
async function showTestPlan(testsToRun, quiet) {
	try {
		const suite = new SalesforceMcpTestSuite(null, quiet);
		const {tests} = await suite.runTests(testsToRun);

		const totalTests = tests.length;
		const requiredTests = tests.filter((t) => t.required).length;
		const optionalTests = totalTests - requiredTests;

		if (!quiet) {
			console.log(`📊 Total tests: ${TEST_CONFIG.colors.bright}${totalTests}${TEST_CONFIG.colors.reset}`);
			console.log(`🔒 Required tests: ${TEST_CONFIG.colors.green}${requiredTests}${TEST_CONFIG.colors.reset}`);
			console.log(`⚙️  Optional tests: ${TEST_CONFIG.colors.cyan}${optionalTests}${TEST_CONFIG.colors.reset}`);
			console.log('');
		} else {
			console.log(`📋 Test plan: ${totalTests} tests (${requiredTests} required, ${optionalTests} optional)`);
		}
	} catch (error) {
		console.error(`${TEST_CONFIG.colors.red}Error showing test plan:${TEST_CONFIG.colors.reset}`, error.message);
		process.exit(1);
	}
}

// Main execution function
async function main() {
	const cmdArgs = testHelpers.parseCommandLineArgs();
	console.log('Debug: cmdArgs =', JSON.stringify(cmdArgs, null, 2));
	const LogLevel = cmdArgs.logLevel || TEST_CONFIG.mcpServer.defaultLogLevel;
	const TestsToRun = cmdArgs.tests ? cmdArgs.tests.split(',').map((test) => test.trim()) : null;
	const Compact = Boolean(cmdArgs.compact);
	const Quiet = Boolean(cmdArgs.quiet);
	const ShowPlan = Boolean(cmdArgs['plan-only']);

	// Optional: allow specifying server target from CLI (in addition to env vars)
	// Examples:
	//   --serverSpec="npx:test_research4@1.2.3#test_research"
	//   --serverSpec="./dist/index.js"  (node) or "./server.py" (python)
	//   --serverArgs="--stdio --flag value" or JSON: --serverArgs='["--stdio","--flag","value"]'
	if (cmdArgs.serverSpec) {
		process.env.MCP_TEST_SERVER_SPEC = cmdArgs.serverSpec;
	}
	if (cmdArgs.serverArgs) {
		process.env.MCP_TEST_SERVER_ARGS = cmdArgs.serverArgs;
	}

	// Show tests to run if specified
	if (!Quiet) {
		if (TestsToRun) {
			console.log(`${TEST_CONFIG.colors.cyan}Selected tests to run: ${TestsToRun.join(', ')} using log level: ${LogLevel}${TEST_CONFIG.colors.reset}`);
		} else {
			console.log(`${TEST_CONFIG.colors.cyan}Running all available tests using log level: ${LogLevel}${TEST_CONFIG.colors.reset}`);
		}
	}

	// If --plan is specified, show test plan and exit
	if (ShowPlan) {
		await showTestPlan(TestsToRun, Quiet);
		return;
	}

	// Run tests
	const runner = new TestRunner({compact: Compact, quiet: Quiet});
	try {
		await runner.runAllTests({
			tests: TestsToRun,
			logLevel: LogLevel
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
  --serverSpec=<spec> Server target. Examples:
                     - npx:@scope/pkg@ver#bin
                     - ./server.js (node) / ./server.py (python)
  --serverArgs=<args> Server args as space-separated string or JSON array
  --compact           Reduce output by hiding tool outputs
  --quiet             Minimal output; only one-line per test result
  --plan-only         Show test plan without executing tests
  --help              Show this help message

${TEST_CONFIG.colors.cyan}Examples:${TEST_CONFIG.colors.reset}
  node test/runner.js --logLevel=debug
  node test/runner.js --tests=apexDebugLogs,getRecord
  node test/runner.js --logLevel=debug --tests=salesforceMcpUtils
  node test/runner.js --serverSpec='npx:test_research4@1.2.3#test_research'
  node test/runner.js --serverSpec='./dist/index.js' --serverArgs='--stdio'
  node test/runner.js --compact
  node test/runner.js --quiet --tests=apexDebugLogs
  node test/runner.js --plan-only
  node test/runner.js --plan-only --tests=apexDebugLogs
`);
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const cmdArgs = testHelpers.parseCommandLineArgs();

	if (cmdArgs.help) {
		showHelp();
	} else {
		main();
	}
}

export {TestRunner};
