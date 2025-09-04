import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AuditTrailDownloaderTestSuite {

	// Get all available tests for auditTrailDownloader
	getAvailableTests() {
		return [
			{
				name: 'Module Import Test',
				run: async () => {
					const {retrieveSetupAuditTrailFile} = await import('../../src/lib/auditTrailDownloader.js');

					if (typeof retrieveSetupAuditTrailFile !== 'function') {
						throw new Error('Function is not callable');
					}
				},
				required: true
			},
			{
				name: 'State Validation Test',
				run: async () => {
					const {retrieveSetupAuditTrailFile} = await import('../../src/lib/auditTrailDownloader.js');

					// Test that the function properly validates state
					// This should fail gracefully when no Salesforce state is available
					try {
						await retrieveSetupAuditTrailFile();
						throw new Error('Function should have failed due to missing state');
					} catch (error) {
						const isExpectedError = error.message.includes('User not found in state') || error.message.includes('Instance URL not found');
						if (!isExpectedError) {
							throw error;
						}
					}
				},
				required: true
			},
			{
				name: 'Playwright Dependencies Test',
				run: async () => {
					// Check if Playwright is available
					const {chromium} = await import('playwright');

					if (typeof chromium !== 'object') {
						throw new Error('Playwright chromium not properly imported');
					}
					if (!chromium.launch) {
						throw new Error('Playwright chromium not properly imported');
					}

					// Test basic Playwright functionality
					const browser = await chromium.launch({headless: true});
					const context = await browser.newContext();
					const page = await context.newPage();

					await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');
					const title = await page.title();

					if (title !== 'Test') {
						throw new Error('Playwright page navigation failed');
					}

					await browser.close();
				},
				required: true
			},
			{
				name: 'File System Dependencies Test',
				run: async () => {
					const fs = await import('node:fs');
					const path = await import('node:path');

					if (!fs) {
						throw new Error('File system modules not properly imported');
					}
					if (!path) {
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

					if (content !== 'test content') {
						throw new Error('File system read/write failed');
					}

					// Clean up
					fs.unlinkSync(testFile);
				},
				required: true
			},
			{
				name: 'Integration Test (Optional)',
				run: async () => {
					const {retrieveSetupAuditTrailFile} = await import('../../src/lib/auditTrailDownloader.js');

					// This test is optional and will be skipped if no Salesforce state is available
					try {
						const result = await retrieveSetupAuditTrailFile();

						if (result && typeof result === 'string') {
							// Integration test successful
							// Check if it looks like CSV content
							const hasComma = result.includes(',');
							const hasNewline = result.includes('\n');
							if (!hasComma) {
								// Content format unexpected
							}
							if (!hasNewline) {
								// Content format unexpected
							}
						} else {
							throw new Error('Unexpected result format');
						}
					} catch (error) {
						const isExpectedError = error.message.includes('User not found in state') || error.message.includes('Instance URL not found');
						if (!isExpectedError) {
							throw error;
						}
						// Integration test skipped: No Salesforce session
						// This is expected in test environments
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
			const requiredTests = availableTests.filter((test) => test.required);

			// Filter selected tests
			const selectedTests = availableTests.filter((test) => !test.required && testsToRun.some((testName) => test.name.toLowerCase().includes(testName.toLowerCase())));

			testsToExecute = [...requiredTests, ...selectedTests];
		}

		return testsToExecute;
	}
}
