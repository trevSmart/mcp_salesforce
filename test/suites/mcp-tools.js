import {TEST_CONFIG} from '../test-config.js';
import fs from 'fs';

// TestContext class for sharing data between tests
class TestContext {
	constructor() {
		this.data = new Map();
	}

	set(key, value) {
		this.data.set(key, value);
	}

	get(key) {
		return this.data.get(key);
	}

	has(key) {
		return this.data.has(key);
	}

	clear() {
		this.data.clear();
	}
}

export class MCPToolsTestSuite {
	// Configuration constants
	static TOOL_OUTPUT_MAX_LENGTH = 600;

	constructor(mcpClient) {
		this.mcpClient = mcpClient;
		this.context = new TestContext();
	}

	// Display tool output in a formatted way
	displayToolOutput(toolName, result) {
		console.log(`\n${TEST_CONFIG.colors.cyan}=== Tool Output: ${toolName} ===${TEST_CONFIG.colors.reset}`);

		// Debug: Log the raw result structure
		// console.log(`${TEST_CONFIG.colors.yellow}🔍 Debug - Raw result:${TEST_CONFIG.colors.reset}`, JSON.stringify(result, null, 2));

		if (result && Boolean(result.isError)) {
			console.log(`${TEST_CONFIG.colors.red}❌ Error:${TEST_CONFIG.colors.reset}`, result.content?.[0]?.text || 'Unknown error');
			return;
		}

		// Helper function to truncate long output
		const truncateOutput = (text, maxLength = MCPToolsTestSuite.TOOL_OUTPUT_MAX_LENGTH) => {
			if (typeof text !== 'string') { return text; }
			if (text.length <= maxLength) { return text; }
			return text.substring(0, maxLength) + '... [truncated]';
		};

		// Display text content (always show, even if empty)
		console.log(`${TEST_CONFIG.colors.green}✓ Text Content:${TEST_CONFIG.colors.reset}`);
		if (result?.content && result.content.length > 0) {
			for (const content of result.content) {
				if (content.type === 'text') {
					// Check if text content is JSON and indent it properly
					try {
						const parsedContent = JSON.parse(content.text);
						const indentedContent = JSON.stringify(parsedContent, null, 2);
						const indentedLines = indentedContent.split('\n').map(line => `    ${line}`).join('\n');
						console.log(`${TEST_CONFIG.colors.yellow}${truncateOutput(indentedLines)}${TEST_CONFIG.colors.reset}`);
					} catch (error) {
						// If not JSON, display as regular text
						console.log(`${TEST_CONFIG.colors.yellow}    ${truncateOutput(content.text)}${TEST_CONFIG.colors.reset} || ${error}`);
					}
				} else if (content.type === 'image') {
					console.log(`${TEST_CONFIG.colors.yellow}    [Image: ${content.imageUrl || 'No URL'}]${TEST_CONFIG.colors.reset}`);
				} else if (content.type === 'code') {
					console.log(`${TEST_CONFIG.colors.yellow}    [Code Block: ${content.language || 'No language'}]${TEST_CONFIG.colors.reset}`);
					console.log(`${TEST_CONFIG.colors.yellow}    ${truncateOutput(content.text)}${TEST_CONFIG.colors.reset}`);
				}
			}
		} else {
			console.log(`${TEST_CONFIG.colors.yellow}    (empty or not available)${TEST_CONFIG.colors.reset}`);
		}

		// Add spacing between sections
		console.log('');

		// Display structured content (always show, even if empty)
		console.log(`${TEST_CONFIG.colors.green}✓ Structured Content:${TEST_CONFIG.colors.reset}`);
		if (result?.structuredContent && Object.keys(result.structuredContent).length > 0) {
			const structuredStr = JSON.stringify(result.structuredContent, null, 2);
			// Indent the structured content with 4 spaces
			const indentedStructured = structuredStr.split('\n').map(line => `    ${line}`).join('\n');
			console.log(`${TEST_CONFIG.colors.yellow}${truncateOutput(indentedStructured)}${TEST_CONFIG.colors.reset}`);
		} else {
			console.log(`${TEST_CONFIG.colors.yellow}    (empty or not available)${TEST_CONFIG.colors.reset}`);
		}

		// Display any other result properties
		const otherProps = Object.keys(result || {}).filter(key =>
			!['structuredContent', 'content', 'isError'].includes(key)
		);

		if (otherProps.length > 0) {
			console.log(`${TEST_CONFIG.colors.green}✓ Other Properties:${TEST_CONFIG.colors.reset}`);
			for (const prop of otherProps) {
				const propValue = JSON.stringify(result?.[prop]);
				console.log(`  ${prop}: ${truncateOutput(propValue)}`);
			}
		}

		console.log(`\n${TEST_CONFIG.colors.cyan}=== End Tool Output ===${TEST_CONFIG.colors.reset}`);
	}

	// Get all available MCP tool tests
	getAvailableTests() {
		return [
			{
				name: 'Initialize MCP Connection',
				run: async () => {
					await this.mcpClient.initialize({name: 'IBM Salesforce MCP Test Client', version: '1.0.0'});
				},
				required: true
			},
			{
				name: 'List Available Tools',
				run: async () => {
					await this.mcpClient.listTools();
				},
				required: true
			},
			{
				name: 'salesforceMcpUtils getOrgAndUserDetails',
				run: async () => {
					return await this.mcpClient.callTool('salesforceMcpUtils', {action: 'getOrgAndUserDetails'});
				},
				required: true,
				thenWait: 2500
			},
			{
				name: 'salesforceMcpUtils getState',
				run: async () => {
					return await this.mcpClient.callTool('salesforceMcpUtils', {action: 'getState'});
				}
			},
			{
				name: 'salesforceMcpUtils getCurrentDatetime',
				run: async () => {
					return await this.mcpClient.callTool('salesforceMcpUtils', {action: 'getCurrentDatetime'});
				}
			},
			{
				name: 'salesforceMcpUtils clearCache',
				run: async () => {
					return await this.mcpClient.callTool('salesforceMcpUtils', {action: 'clearCache'});
				}
			},
			{
				name: 'salesforceMcpUtils reportIssue validation',
				run: async () => {
					try {
						const result = await this.mcpClient.callTool('salesforceMcpUtils', {
							action: 'reportIssue',
							issueDescription: 'Short',
							issueToolName: 'testTool'
						});

						// Check if the result contains an error message
						if (result.content && result.content[0] && result.content[0].text &&
							result.content[0].text.includes('issueDescription is required and must be at least 10 characters long')) {
							return {
								content: [{
									type: 'text',
									text: '✅ Validation working correctly - rejected short description'
								}],
								structuredContent: {validation: 'passed'}
							};
						}

						throw new Error('Expected validation error for short description');
					} catch (error) {
						// If the error is thrown by the tool itself, that's also valid
						if (error.message.includes('issueDescription is required and must be at least 10 characters long')) {
							return {
								content: [{
									type: 'text',
									text: '✅ Validation working correctly - rejected short description'
								}],
								structuredContent: {validation: 'passed'}
							};
						}
						throw error;
					}
				}
			},
			{
				name: 'apexDebugLogs status',
				run: async () => {
					return await this.mcpClient.callTool('apexDebugLogs', {action: 'status'});
				}
			},
			{
				name: 'apexDebugLogs on',
				run: async () => {
					return await this.mcpClient.callTool('apexDebugLogs', {action: 'on'});
				}
			},
			{
				name: 'apexDebugLogs list',
				run: async () => {
					return await this.mcpClient.callTool('apexDebugLogs', {action: 'list'});
				},
				script: async (result, context) => {
					console.log(`${TEST_CONFIG.colors.cyan}Saving logId in context...${TEST_CONFIG.colors.reset}`);
					context.set('logId', result.structuredContent.logs[0].Id);
				}
			},
			{
				name: 'apexDebugLogs get',
				run: async (context) => {
					const logId = context.get('logId');
					if (!logId) {
						throw new Error('logId not found in context. Make sure apexDebugLogs list test runs first and sets the logId.');
					}
					return await this.mcpClient.callTool('apexDebugLogs', {
						action: 'get',
						logId: logId
					});
				}
			},
			{
				name: 'apexDebugLogs off',
				run: async () => {
					return await this.mcpClient.callTool('apexDebugLogs', {action: 'off'});
				}
			},
			{
				name: 'describeObject Account',
				run: async () => {
					return await this.mcpClient.callTool('describeObject', {
						sObjectName: 'Account',
						include: 'fields'
					});
				}
			},
			{
				name: 'executeSoqlQuery',
				run: async () => {
					return await this.mcpClient.callTool('executeSoqlQuery', {
						query: 'SELECT Id, Name FROM Account LIMIT 3'
					});
				}
			},
			{
				name: 'getRecentlyViewedRecords',
				run: async () => {
					return await this.mcpClient.callTool('getRecentlyViewedRecords', {});
				}
			},
			{
				name: 'getApexClassCodeCoverage',
				run: async () => {
					return await this.mcpClient.callTool('getApexClassCodeCoverage', {
						classNames: ['TestMCPTool']
					});
				}
			},
			{
				name: 'createMetadata Apex Class',
				run: async () => {
					return await this.mcpClient.callTool('createMetadata', {
						type: 'apexClass',
						name: 'TestMCPToolClass'
					});
				},
				script: async () => {
					// Clean up force-app directory
					const forceAppPath = 'force-app';
					if (fs.existsSync(forceAppPath)) {
						fs.rmSync(forceAppPath, {recursive: true, force: true});
						console.warn(`Deleted directory: ${forceAppPath}`);
					}
				}
			},
			{
				name: 'createMetadata Apex Test Class',
				run: async () => {
					return await this.mcpClient.callTool('createMetadata', {
						type: 'apexTestClass',
						name: 'TestMCPToolClassTest'
					});
				},
				script: async () => {
					// Clean up force-app directory
					const forceAppPath = 'force-app';
					if (fs.existsSync(forceAppPath)) {
						fs.rmSync(forceAppPath, {recursive: true, force: true});
						console.warn(`Deleted directory: ${forceAppPath}`);
					}
				}
			},
			{
				name: 'createMetadata Apex Trigger',
				run: async () => {
					return await this.mcpClient.callTool('createMetadata', {
						type: 'apexTrigger',
						name: 'TestMCPToolTrigger',
						triggerSObject: 'Account',
						triggerEvent: ['after insert', 'before update']
					});
				},
				script: async () => {
					// Clean up force-app directory
					const forceAppPath = 'force-app';
					if (fs.existsSync(forceAppPath)) {
						fs.rmSync(forceAppPath, {recursive: true, force: true});
						console.warn(`Deleted directory: ${forceAppPath}`);
					}
				}
			},
			{
				name: 'createMetadata LWC',
				run: async () => {
					return await this.mcpClient.callTool('createMetadata', {
						type: 'lwc',
						name: 'testMCPToolComponent'
					});
				},
				script: async () => {
					// Clean up force-app directory
					const forceAppPath = 'force-app';
					if (fs.existsSync(forceAppPath)) {
						fs.rmSync(forceAppPath, {recursive: true, force: true});
						console.warn(`Deleted directory: ${forceAppPath}`);
					}
				}
			},
			/*
			{
				name: 'deployMetadata',
				run: async () => {
					return await this.mcpClient.callTool('deployMetadata', {
						sourceDir: 'force-app/main/default/classes/TestMCPToolClass.cls'
					});
				}
			},
			*/
			{
				name: 'dmlOperation Create',
				run: async () => {
					return await this.mcpClient.callTool('dmlOperation', {
						operations: {
							create: [{
								sObjectName: 'Account',
								fields: {
									Name: 'Test MCP Tool Account',
									Description: 'Account created by MCP tool test'
								}
							}]
						}
					});
				},
				script: async (result, context) => {
					// Extract the created record ID from the DML operation response
					const createdRecordId = result?.structuredContent?.successes?.[0]?.id;
					console.log(`${TEST_CONFIG.colors.cyan}Saving created record Id in context...${TEST_CONFIG.colors.reset}`);
					if (createdRecordId) {
						context.set('createdAccountId', createdRecordId);
						console.log(`${TEST_CONFIG.colors.green}✓ Saved createdAccountId: ${createdRecordId}${TEST_CONFIG.colors.reset}`);
					} else {
						console.log(`${TEST_CONFIG.colors.red}❌ No created record ID found in response${TEST_CONFIG.colors.reset}`);
						console.log(`${TEST_CONFIG.colors.yellow}Response structure: ${JSON.stringify(result?.structuredContent, null, 2)}${TEST_CONFIG.colors.reset}`);
					}
				}
			},
			{
				name: 'getRecord',
				run: async (context) => {
					const createdAccountId = context.get('createdAccountId');
					if (!createdAccountId) {
						throw new Error('createdAccountId not found in context. Make sure dmlOperation Create test runs first and sets the createdAccountId.');
					}

					console.log(`${TEST_CONFIG.colors.cyan}Using createdAccountId: ${createdAccountId}${TEST_CONFIG.colors.reset}`);

					return await this.mcpClient.callTool('getRecord', {
						sObjectName: 'Account',
						recordId: createdAccountId
					});
				}
			},
			{
				name: 'dmlOperation Update',
				run: async (context) => {
					const createdAccountId = context.get('createdAccountId');
					if (!createdAccountId) {
						throw new Error('createdAccountId not found in context. Make sure dmlOperation Create test runs first and sets the createdAccountId.');
					}

					return await this.mcpClient.callTool('dmlOperation', {
						operations: {
							update: [{
								sObjectName: 'Account',
								recordId: createdAccountId,
								fields: {
									Description: `Updated by MCP Tool test at ${new Date().toISOString()}`
								}
							}]
						}
					});
				}
			},
			{
				name: 'dmlOperation Delete',
				run: async (context) => {
					const createdAccountId = context.get('createdAccountId');
					if (!createdAccountId) {
						throw new Error('createdAccountId not found in context. Make sure dmlOperation Create test runs first and sets the createdAccountId.');
					}

					return await this.mcpClient.callTool('dmlOperation', {
						operations: {
							delete: [{
								sObjectName: 'Account',
								recordId: createdAccountId
							}]
						}
					});
				}
			},
			{
				name: 'executeAnonymousApex',
				run: async () => {
					return await this.mcpClient.callTool('executeAnonymousApex', {
						apexCode: 'System.debug(\'Hello from MCP tool test\');\nSystem.debug(\'Current time: \' + Datetime.now());',
						mayModify: false
					});
				}
			},
			{
				name: 'getSetupAuditTrail',
				run: async () => {
					return await this.mcpClient.callTool('getSetupAuditTrail', {lastDays: 7});
				}
			},
			{
				name: 'runApexTest',
				run: async () => {
					return await this.mcpClient.callTool('runApexTest', {
						classNames: [TEST_CONFIG.salesforce.runApexTestClassName]
					});
				}
			}
		];
	}

	// Run specific tests or all tests
	async runTests(testsToRun = null) {
		const availableTests = this.getAvailableTests();

		// Filter tests to run
		let testsToExecute = availableTests;
		if (testsToRun?.length) {
			// Always include required tests (tests with required: true)
			const requiredTests = availableTests.filter(test => test.required === true);

			// Filter selected tests (tests without required: true)
			const selectedTests = availableTests.filter(test =>
				test.required !== true && testsToRun.some(testName =>
					test.name.toLowerCase().includes(testName.toLowerCase())
				)
			);

			testsToExecute = [...requiredTests, ...selectedTests];

			if (selectedTests.length > 0) {
				console.log(`${TEST_CONFIG.colors.cyan}Running ${selectedTests.length} selected tests plus ${requiredTests.length} required tests${TEST_CONFIG.colors.reset}`);
				console.log(`${TEST_CONFIG.colors.cyan}Selected tests: ${selectedTests.map(t => t.name).join(', ')}${TEST_CONFIG.colors.reset}`);
			} else {
				console.log(`${TEST_CONFIG.colors.yellow}No tests found matching: ${testsToRun.join(', ')}${TEST_CONFIG.colors.reset}`);
				console.log(`${TEST_CONFIG.colors.cyan}Running only ${requiredTests.length} required tests${TEST_CONFIG.colors.reset}`);
			}
		}

		// Clear context before running tests
		this.context.clear();

		// Return the tests to execute without running them
		// The TestRunner will handle the actual execution
		return testsToExecute;
	}
}
