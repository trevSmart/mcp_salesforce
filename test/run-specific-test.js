#!/usr/bin/env node

import {TestMcpClient} from 'ibm-test-mcp-client';
import * as TestSuites from '../src/__tests__/index.js';

// Map tool names to their test suites
const toolTestMap = {
	'apexDebugLogs': TestSuites.ApexDebugLogsTestSuite,
	'salesforceMcpUtils': TestSuites.SalesforceMcpUtilsTestSuite,
	'describeObject': TestSuites.DescribeObjectTestSuite,
	'executeSoqlQuery': TestSuites.ExecuteSoqlQueryTestSuite,
	'getRecentlyViewedRecords': TestSuites.GetRecentlyViewedRecordsTestSuite,
	'getRecord': TestSuites.GetRecordTestSuite,
	'dmlOperation': TestSuites.DmlOperationTestSuite,
	'executeAnonymousApex': TestSuites.ExecuteAnonymousApexTestSuite,
	'getSetupAuditTrail': TestSuites.GetSetupAuditTrailTestSuite,
	'runApexTest': TestSuites.RunApexTestTestSuite,
	'getApexClassCodeCoverage': TestSuites.GetApexClassCodeCoverageTestSuite,
	'createMetadata': TestSuites.CreateMetadataTestSuite,
	'deployMetadata': TestSuites.DeployMetadataTestSuite,
	'invokeApexRestResource': TestSuites.InvokeApexRestResourceTestSuite,
	'generateSoqlQuery': TestSuites.GenerateSoqlQueryTestSuite,
	'chatWithAgentforce': TestSuites.ChatWithAgentforceTestSuite,
	'triggerExecutionOrder': TestSuites.TriggerExecutionOrderTestSuite,
};

// Map prompt names to their test suites
const promptTestMap = {
	'apex-run-script': TestSuites.ApexRunScriptPromptTestSuite,
	// Add more mappings as you create more prompt test suites
};

async function runSpecificTest(testName) {
	const mcpClient = new TestMcpClient();

	try {
		// Check if it's a tool test
		if (toolTestMap[testName]) {
			console.log(`Running tests for tool: ${testName}`);
			const testSuite = new toolTestMap[testName](mcpClient);
			const tests = await testSuite.runTests();

			// Execute tests sequentially for now
			for (const test of tests) {
				console.log(`Running: ${test.name}`);
				try {
					const result = await test.run();
					console.log(`✅ ${test.name} - PASSED`);
				} catch (error) {
					console.log(`❌ ${test.name} - FAILED: ${error.message}`);
				}
			}
		}
		// Check if it's a prompt test
		else if (promptTestMap[testName]) {
			console.log(`Running tests for prompt: ${testName}`);
			const testSuite = new promptTestMap[testName](mcpClient);
			const tests = await testSuite.runTests();

			for (const test of tests) {
				console.log(`Running: ${test.name}`);
				try {
					const result = await test.run();
					console.log(`✅ ${test.name} - PASSED`);
				} catch (error) {
					console.log(`❌ ${test.name} - FAILED: ${error.message}`);
				}
			}
		}
		// Unknown test
		else {
			console.log(`❌ Unknown test: ${testName}`);
			console.log('Available tool tests:', Object.keys(toolTestMap).join(', '));
			console.log('Available prompt tests:', Object.keys(promptTestMap).join(', '));
		}
	} catch (error) {
		console.error('Error running tests:', error);
	} finally {
		await mcpClient.close();
	}
}

// Get test name from command line arguments
const testName = process.argv[2];
if (!testName) {
	console.log('Usage: node test/run-specific-test.js <testName>');
	console.log('Available tool tests:', Object.keys(toolTestMap).join(', '));
	console.log('Available prompt tests:', Object.keys(promptTestMap).join(', '));
	process.exit(1);
}

runSpecificTest(testName);
