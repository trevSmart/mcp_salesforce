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
    console.log(`\n${TEST_CONFIG.colors.cyan}${'='.repeat(50)}${TEST_CONFIG.colors.reset}`);
    console.log(`${TEST_CONFIG.colors.orange}Running test: ${name}${TEST_CONFIG.colors.reset}`);
    console.log(`${TEST_CONFIG.colors.cyan}${'='.repeat(50)}${TEST_CONFIG.colors.reset}`);

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

    console.log(`\n${status} ${name} (${duration}ms)`);

    this.testResults.push({
      name,
      success,
      duration,
      error: error?.message
    });

    return success;
  }

  // Run MCP tools tests
  async runMCPToolsTests(testsToRun = null) {
    const mcpToolsSuite = new MCPToolsTestSuite(this.mcpClient);
    const testsToExecute = await mcpToolsSuite.runTests(testsToRun);

    for (const test of testsToExecute) {
      await this.runTest(`Test ${test.name}`, test.run);
    }
  }

  // Run all tests
  async runAllTests(options = {}) {
    const {tests, logLevel} = options;

    try {
      // Ensure we're in the test org
      console.log(`${TEST_CONFIG.colors.orange}Managing Salesforce org...${TEST_CONFIG.colors.reset}`);
      this.originalOrg = await SalesforceOrgManager.ensureTestOrg();

      // Start server
      console.log(`${TEST_CONFIG.colors.bright}Starting MCP Client Tests${TEST_CONFIG.colors.reset}\n\n`);
      await this.serverManager.start();

      // Wait for server to fully start
      await new Promise(resolveTimeout => setTimeout(resolveTimeout, TEST_CONFIG.mcpServer.startupDelay));

      // Create MCP client and set up communication
      this.mcpClient = new MCPClient(this.serverManager.getProcess());

      // Set up stdout handling for the client
      this.serverManager.getProcess().stdout.on('data', (data) => {
        this.mcpClient.handleServerMessage(data);
      });

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
    console.log(`\n${TEST_CONFIG.colors.cyan}${'='.repeat(50)}${TEST_CONFIG.colors.reset}`);
    console.log(`${TEST_CONFIG.colors.bright}Test Summary${TEST_CONFIG.colors.reset}`);
    console.log(`${TEST_CONFIG.colors.cyan}${'='.repeat(50)}${TEST_CONFIG.colors.reset}`);

    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.success).length;
    const failed = total - passed;

    console.log(`Total tests: ${total}`);
    console.log(`Passed: ${TEST_CONFIG.colors.green}${passed}${TEST_CONFIG.colors.reset}`);
    console.log(`Failed: ${TEST_CONFIG.colors.red}${failed}${TEST_CONFIG.colors.reset}`);

    if (failed > 0) {
      console.log(`\n${TEST_CONFIG.colors.red}Failed tests:${TEST_CONFIG.colors.reset}`);
      this.testResults
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }

    console.log(`\n${failed === 0 ? TEST_CONFIG.colors.green : TEST_CONFIG.colors.red}${failed === 0 ? 'All tests passed!' : 'Some tests failed!'}${TEST_CONFIG.colors.reset}`);
  }
}

// Main execution function
async function main() {
  const cmdArgs = TestHelpers.parseCommandLineArgs();
  const LOG_LEVEL = cmdArgs.logLevel || TEST_CONFIG.salesforce.defaultLogLevel;
  const TESTS_TO_RUN = cmdArgs.tests ? cmdArgs.tests.split(',').map(test => test.trim()) : null;

  // Show log level being used
  console.log(`${TEST_CONFIG.colors.cyan}Using log level: ${LOG_LEVEL}${TEST_CONFIG.colors.reset}`);

  // Show tests to run if specified
  if (TESTS_TO_RUN) {
    console.log(`${TEST_CONFIG.colors.cyan}Selected tests to run: ${TESTS_TO_RUN.join(', ')}${TEST_CONFIG.colors.reset}`);
  } else {
    console.log(`${TEST_CONFIG.colors.cyan}Running all available tests${TEST_CONFIG.colors.reset}`);
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
  --logLevel=<level>  Set the logging level (default: ${TEST_CONFIG.salesforce.defaultLogLevel})
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
