import {TEST_CONFIG} from '../test-config.js';
import {fileURLToPath} from 'url';
import {dirname, resolve} from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AuditTrailDownloaderTestSuite {
	constructor() {
		// This test suite doesn't need MCP client as it tests the module directly
	}

	// Get all available tests for auditTrailDownloader
	getAvailableTests() {
		return [
			{
				name: 'Module Import Test',
				run: async() => {
					console.log('Testing module import...');

					try {
						const {retrieveSetupAuditTrailFile} = await import('../../src/lib/auditTrailDownloader.js');

						if (typeof retrieveSetupAuditTrailFile === 'function') {
							console.log(`${TEST_CONFIG.colors.green}✓ Module imported successfully${TEST_CONFIG.colors.reset}`);
							console.log(`${TEST_CONFIG.colors.green}✓ Function 'retrieveSetupAuditTrailFile' is available${TEST_CONFIG.colors.reset}`);
						} else {
							throw new Error('Function is not callable');
						}
					} catch (error) {
						console.error(`${TEST_CONFIG.colors.red}✗ Module import failed:${TEST_CONFIG.colors.reset}`, error.message);
						throw error;
					}
				},
				required: true
			},
			{
				name: 'Function Signature Validation',
				run: async() => {
					console.log('Testing function signature...');

					try {
						const {retrieveSetupAuditTrailFile} = await import('../../src/lib/auditTrailDownloader.js');

						// Check if function is async
						const functionString = retrieveSetupAuditTrailFile.toString();
						const isAsync = functionString.includes('async');

						if (isAsync) {
							console.log(`${TEST_CONFIG.colors.green}✓ Function is async (as expected)${TEST_CONFIG.colors.reset}`);
						} else {
							console.log(`${TEST_CONFIG.colors.yellow}⚠ Function is not async${TEST_CONFIG.colors.reset}`);
						}

						// Check if function returns a Promise
						const result = retrieveSetupAuditTrailFile();
						if (result instanceof Promise) {
							console.log(`${TEST_CONFIG.colors.green}✓ Function returns a Promise${TEST_CONFIG.colors.reset}`);
						} else {
							console.log(`${TEST_CONFIG.colors.yellow}⚠ Function does not return a Promise${TEST_CONFIG.colors.reset}`);
						}

					} catch (error) {
						console.error(`${TEST_CONFIG.colors.red}✗ Function signature validation failed:${TEST_CONFIG.colors.reset}`, error.message);
						throw error;
					}
				},
				required: true
			},
			{
				name: 'State Validation Test',
				run: async() => {
					console.log('Testing state validation logic...');

					try {
						const {retrieveSetupAuditTrailFile} = await import('../../src/lib/auditTrailDownloader.js');

						// Test that the function properly validates state
						// This should fail gracefully when no Salesforce state is available
						try {
							await retrieveSetupAuditTrailFile();
							throw new Error('Function should have failed due to missing state');
						} catch (error) {
							if (error.message.includes('User not found in state') ||
								error.message.includes('Instance URL not found')) {
								console.log(`${TEST_CONFIG.colors.green}✓ State validation working correctly${TEST_CONFIG.colors.reset}`);
								console.log(`${TEST_CONFIG.colors.blue}Expected error: ${error.message}${TEST_CONFIG.colors.reset}`);
							} else {
								throw error;
							}
						}

					} catch (error) {
						console.error(`${TEST_CONFIG.colors.red}✗ State validation test failed:${TEST_CONFIG.colors.reset}`, error.message);
						throw error;
					}
				},
				required: true
			},
			{
				name: 'Playwright Dependencies Test',
				run: async() => {
					console.log('Testing Playwright dependencies...');

					try {
						// Check if Playwright is available
						const {chromium} = await import('playwright');

						if (typeof chromium === 'object' && chromium.launch) {
							console.log(`${TEST_CONFIG.colors.green}✓ Playwright chromium is available${TEST_CONFIG.colors.reset}`);
						} else {
							throw new Error('Playwright chromium not properly imported');
						}

						// Test basic Playwright functionality
						const browser = await chromium.launch({headless: true});
						const context = await browser.newContext();
						const page = await context.newPage();

						await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');
						const title = await page.title();

						if (title === 'Test') {
							console.log(`${TEST_CONFIG.colors.green}✓ Basic Playwright functionality working${TEST_CONFIG.colors.reset}`);
						} else {
							throw new Error('Playwright page navigation failed');
						}

						await browser.close();

					} catch (error) {
						console.error(`${TEST_CONFIG.colors.red}✗ Playwright dependencies test failed:${TEST_CONFIG.colors.reset}`, error.message);
						throw error;
					}
				},
				required: true
			},
			{
				name: 'File System Dependencies Test',
				run: async() => {
					console.log('Testing file system dependencies...');

					try {
						const fs = await import('fs');
						const path = await import('path');

						if (fs && path) {
							console.log(`${TEST_CONFIG.colors.green}✓ File system modules available${TEST_CONFIG.colors.reset}`);
						} else {
							throw new Error('File system modules not properly imported');
						}

						// Test basic file system operations
						const testDir = resolve(__dirname, '../tmp');
						const testFile = path.join(testDir, 'test.txt');

						// Create test directory if it doesn't exist
						if (!fs.existsSync(testDir)) {
							fs.mkdirSync(testDir, {recursive: true});
						}

						// Write test file
						fs.writeFileSync(testFile, 'test content');

						// Read test file
						const content = fs.readFileSync(testFile, 'utf8');

						if (content === 'test content') {
							console.log(`${TEST_CONFIG.colors.green}✓ File system operations working${TEST_CONFIG.colors.reset}`);
						} else {
							throw new Error('File system read/write failed');
						}

						// Clean up
						fs.unlinkSync(testFile);

					} catch (error) {
						console.error(`${TEST_CONFIG.colors.red}✗ File system dependencies test failed:${TEST_CONFIG.colors.reset}`, error.message);
						throw error;
					}
				},
				required: true
			},
			{
				name: 'Integration Test (Optional)',
				run: async() => {
					console.log('Testing full integration (requires Salesforce session)...');
					console.log(`${TEST_CONFIG.colors.yellow}⚠ This test requires a valid Salesforce session${TEST_CONFIG.colors.reset}`);
					console.log(`${TEST_CONFIG.colors.yellow}⚠ It will attempt to download the actual audit trail${TEST_CONFIG.colors.reset}`);

					try {
						const {retrieveSetupAuditTrailFile} = await import('../../src/lib/auditTrailDownloader.js');

						// This test is optional and will be skipped if no Salesforce state is available
						try {
							const result = await retrieveSetupAuditTrailFile();

							if (result && typeof result === 'string') {
								console.log(`${TEST_CONFIG.colors.green}✓ Integration test successful${TEST_CONFIG.colors.reset}`);
								console.log(`${TEST_CONFIG.colors.blue}Downloaded content length: ${result.length} characters${TEST_CONFIG.colors.reset}`);

								// Check if it looks like CSV content
								if (result.includes(',') && result.includes('\n')) {
									console.log(`${TEST_CONFIG.colors.green}✓ Content appears to be valid CSV${TEST_CONFIG.colors.reset}`);
								} else {
									console.log(`${TEST_CONFIG.colors.yellow}⚠ Content format unexpected${TEST_CONFIG.colors.reset}`);
								}
							} else {
								throw new Error('Unexpected result format');
							}

						} catch (error) {
							if (error.message.includes('User not found in state') ||
								error.message.includes('Instance URL not found')) {
								console.log(`${TEST_CONFIG.colors.yellow}⚠ Integration test skipped: No Salesforce session${TEST_CONFIG.colors.reset}`);
								console.log(`${TEST_CONFIG.colors.blue}This is expected in test environments${TEST_CONFIG.colors.reset}`);
							} else {
								throw error;
							}
						}

					} catch (error) {
						console.error(`${TEST_CONFIG.colors.red}✗ Integration test failed:${TEST_CONFIG.colors.reset}`, error.message);
						throw error;
					}
				},
				required: false
			}
		];
	}

	// Run specific tests or all tests
	async runTests(testsToRun = null) {
		const availableTests = this.getAvailableTests();

		// Filter tests to run
		let testsToExecute = availableTests;
		if (testsToRun && testsToRun.length > 0) {
			// Always include required tests
			const requiredTests = availableTests.filter(test => test.required);

			// Filter selected tests
			const selectedTests = availableTests.filter(test =>
				!test.required && testsToRun.some(testName =>
					test.name.toLowerCase().includes(testName.toLowerCase())
				)
			);

			testsToExecute = [...requiredTests, ...selectedTests];

			console.log(`${TEST_CONFIG.colors.cyan}Running ${selectedTests.length} selected tests plus ${requiredTests.length} required tests${TEST_CONFIG.colors.reset}`);
		}

		return testsToExecute;
	}
}
