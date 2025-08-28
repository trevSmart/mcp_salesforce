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

	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.context = new TestContext();
		this.quiet = quiet;
	}

	// Display tool output in a formatted way
	displayToolOutput(toolName, result) {
		// Skip output if quiet mode is enabled
		if (this.quiet) {
			return;
		}

		console.log(`\n${TEST_CONFIG.colors.cyan}=== Tool Output: ${toolName} ===${TEST_CONFIG.colors.reset}`);

		// Debug: Log the raw result structure
		// console.log(`${TEST_CONFIG.colors.yellow}🔍 Debug - Raw result:${TEST_CONFIG.colors.reset}`, JSON.stringify(result, null, 2));

		if (result && Boolean(result.isError)) {
			console.log(`${TEST_CONFIG.colors.red}❌ Error:${TEST_CONFIG.colors.reset}`, result.content?.[0]?.text || 'Unknown error');
			return;
		}

		// Helper function to truncate long output
		const truncateOutput = (text, maxLength = MCPToolsTestSuite.TOOL_OUTPUT_MAX_LENGTH) => {
			if (typeof text !== 'string') {
				return text;
			}
			if (text.length <= maxLength) {
				return text;
			}
			return text.substring(0, maxLength) + '... [truncated]';
		};

		// Display text content (always show, even if empty)
		console.log(`${TEST_CONFIG.colors.green}✓ Text Content:${TEST_CONFIG.colors.reset}`);
		if (result?.content && result.content.length > 0) {
			for (const content of result.content) {
				if (content.type === 'text') {
					// Display text content as-is, without parsing
					console.log(`${TEST_CONFIG.colors.yellow}    ${truncateOutput(content.text)}${TEST_CONFIG.colors.reset}`);
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
					const result = await this.mcpClient.callTool('salesforceMcpUtils', {action: 'getState'});
					const sc = result?.structuredContent;
					if (!sc || !sc.state || sc.client === undefined || sc.resources === undefined) {
						throw new Error('getState: structuredContent must include state, client and resources');
					}
					return result;
				}
			},
			{
				name: 'salesforceMcpUtils loadRecordPrefixesResource',
				run: async () => {
					const result = await this.mcpClient.callTool('salesforceMcpUtils', {action: 'loadRecordPrefixesResource'});
					const sc = result?.structuredContent;
					if (!sc || typeof sc !== 'object' || Array.isArray(sc)) {
						throw new Error('loadRecordPrefixesResource: structuredContent must be an object map');
					}
					if (Object.keys(sc).length === 0) {
						throw new Error('loadRecordPrefixesResource: no prefixes returned');
					}
					return result;
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
						return await this.mcpClient.callTool('salesforceMcpUtils', {
							action: 'reportIssue',
							issueDescription: 'Some description',
							issueToolName: 'testTool'
						});

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
				run: async (context) => {
					const result = await this.mcpClient.callTool('apexDebugLogs', {action: 'list'});
					if (!result?.structuredContent || !Array.isArray(result.structuredContent.logs)) {
						throw new Error('apexDebugLogs list: structuredContent.logs must be an array');
					}
					if (result.structuredContent.logs.length > 0) {
						const first = result.structuredContent.logs[0];
						if (!first.Id) {
							throw new Error('apexDebugLogs list: first log missing Id');
						}
						console.log(`${TEST_CONFIG.colors.cyan}Saving logId in context...${TEST_CONFIG.colors.reset}`);
						context.set('logId', first.Id);
					}
					return result;
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
			/*
			// Temporarily disabled: apexDebugLogs analyze action not available
			{
				name: 'apexDebugLogs analyze',
				run: async (context) => {
					const logId = context.get('logId');
					if (!logId) {
						throw new Error('logId not found in context. Run apexDebugLogs list first.');
					}
					const result = await this.mcpClient.callTool('apexDebugLogs', {
						action: 'analyze',
						logId,
						analyzeOptions: {minDurationMs: 0, maxEvents: 50, output: 'json'}
					});
					const sc = result?.structuredContent;
					if (!sc || !sc.summary) {
						throw new Error('apexDebugLogs analyze: missing summary in structuredContent');
					}
					return result;
				}
			},
			*/
			{
				name: 'apexDebugLogs off',
				run: async () => {
					return await this.mcpClient.callTool('apexDebugLogs', {action: 'off'});
				}
			},
			{
				name: 'describeObject Account',
				run: async () => {
					const result = await this.mcpClient.callTool('describeObject', {
						sObjectName: 'Account'
					});
					if (!result?.structuredContent) {
						throw new Error('describeObject: missing structuredContent');
					}
					if (result.structuredContent.name !== 'Account') {
						throw new Error(`describeObject: expected name Account, got ${result.structuredContent.name}`);
					}
					if (!Array.isArray(result.structuredContent.fields) || result.structuredContent.fields.length === 0) {
						throw new Error('describeObject: fields array missing or empty');
					}
					return result;
				}
			},
			{
				name: 'executeSoqlQuery',
				run: async () => {
					const result = await this.mcpClient.callTool('executeSoqlQuery', {
						query: 'SELECT Id, Name FROM Account LIMIT 3'
					});
					const sc = result?.structuredContent;
					if (!sc || !Array.isArray(sc.records)) {
						throw new Error('executeSoqlQuery: records must be an array');
					}
					if (sc.records.length > 0) {
						const r = sc.records[0];
						if (!r.Id || !r.Name) {
							throw new Error('executeSoqlQuery: first record must include Id and Name');
						}
						if (!r.url) {
							throw new Error('executeSoqlQuery: expected URL added to records');
						}
					}
					return result;
				}
			},
			{
				name: 'getRecentlyViewedRecords',
				run: async () => {
					const result = await this.mcpClient.callTool('getRecentlyViewedRecords', {});
					const sc = result?.structuredContent;
					if (!sc || !Array.isArray(sc.records) || typeof sc.totalSize !== 'number') {
						throw new Error('getRecentlyViewedRecords: invalid structuredContent shape');
					}
					return result;
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
			// (Duplicate removed) createMetadata Apex Class
			{
				name: 'describeObject Account (cached, no fields + picklists)',
				run: async () => {
					const result = await this.mcpClient.callTool('describeObject', {
						sObjectName: 'Account',
						includeFields: false,
						includePicklistValues: true
					});
					const sc = result?.structuredContent;
					if (!sc) {
						throw new Error('describeObject(cached): missing structuredContent');
					}
					if (sc.wasCached !== true) {
						throw new Error('describeObject(cached): expected wasCached=true');
					}
					if (!Array.isArray(sc.fields) || sc.fields.length === 0) {
						throw new Error('describeObject(cached): fields should be present due to includePicklistValues');
					}
					return result;
				}
			},
			{
				name: 'describeObject ApexClass (Tooling API)',
				run: async () => {
					const result = await this.mcpClient.callTool('describeObject', {
						sObjectName: 'ApexClass',
						useToolingApi: true
					});
					const sc = result?.structuredContent;
					if (!sc || sc.name !== 'ApexClass') {
						throw new Error('describeObject (Tooling): invalid name');
					}
					if (!Array.isArray(sc.fields) || sc.fields.length === 0) {
						throw new Error('describeObject (Tooling): fields missing');
					}
					return result;
				}
			},
			{
				name: 'executeSoqlQuery (Tooling API)',
				run: async () => {
					const result = await this.mcpClient.callTool('executeSoqlQuery', {
						query: 'SELECT Id, Name FROM ApexClass LIMIT 3',
						useToolingApi: true
					});
					const sc = result?.structuredContent;
					if (!sc || !Array.isArray(sc.records)) {
						throw new Error('executeSoqlQuery (Tooling): records must be an array');
					}
					if (sc.records.length > 0) {
						const r = sc.records[0];
						if (!r.Id || !r.Name) {
							throw new Error('executeSoqlQuery (Tooling): first record must include Id and Name');
						}
						if (!r.url) {
							throw new Error('executeSoqlQuery (Tooling): expected URL added to records');
						}
					}
					return result;
				}
			},
			// (Removed misplaced cleanup script for duplicate test)
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
				run: async (context) => {
					const result = await this.mcpClient.callTool('dmlOperation', {
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

					const sc = result?.structuredContent;
					if (sc?.outcome !== 'success' || !sc.successes?.[0]?.id) {
						throw new Error('dmlOperation Create: missing success id or non-success outcome');
					}
					const createdRecordId = sc.successes[0].id;
					context.set('createdAccountId', createdRecordId);
					console.log(`${TEST_CONFIG.colors.green}✓ Saved createdAccountId: ${createdRecordId}${TEST_CONFIG.colors.reset}`);
					return result;
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

					const result = await this.mcpClient.callTool('getRecord', {
						sObjectName: 'Account',
						recordId: createdAccountId
					});
					const sc = result?.structuredContent;
					if (!sc || sc.sObject !== 'Account' || sc.id !== createdAccountId) {
						throw new Error('getRecord: invalid sObject or id in structuredContent');
					}
					if (!sc.fields || typeof sc.fields.Name !== 'string') {
						throw new Error('getRecord: expected fields.Name to be present');
					}
					return result;
				}
			},
			{
				name: 'dmlOperation Update',
				run: async (context) => {
					const createdAccountId = context.get('createdAccountId');
					if (!createdAccountId) {
						throw new Error('createdAccountId not found in context. Make sure dmlOperation Create test runs first and sets the createdAccountId.');
					}

					const result = await this.mcpClient.callTool('dmlOperation', {
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
					if (result?.structuredContent?.outcome !== 'success') {
						throw new Error('dmlOperation Update: outcome was not success');
					}
					return result;
				}
			},
			{
				name: 'dmlOperation Delete',
				run: async (context) => {
					const createdAccountId = context.get('createdAccountId');
					if (!createdAccountId) {
						throw new Error('createdAccountId not found in context. Make sure dmlOperation Create test runs first and sets the createdAccountId.');
					}

					const result = await this.mcpClient.callTool('dmlOperation', {
						operations: {
							delete: [{
								sObjectName: 'Account',
								recordId: createdAccountId
							}]
						}
					});
					if (result?.structuredContent?.outcome !== 'success') {
						throw new Error('dmlOperation Delete: outcome was not success');
					}
					return result;
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
					const result = await this.mcpClient.callTool('getSetupAuditTrail', {lastDays: 2});
					const sc = result?.structuredContent;
					if (!sc || typeof sc.setupAuditTrailFileTotalRecords !== 'number' || typeof sc.setupAuditTrailFileFilteredTotalRecords !== 'number') {
						throw new Error('getSetupAuditTrail: missing numeric counters');
					}
					if (!sc.filters || sc.filters.lastDays !== 2) {
						throw new Error('getSetupAuditTrail: filters.lastDays must equal 2');
					}
					if (!Array.isArray(sc.records)) {
						throw new Error('getSetupAuditTrail: records must be an array');
					}
					if (sc.records.length > 0) {
						const r = sc.records[0];
						for (const k of ['date', 'user', 'type', 'action']) {
							if (!(k in r)) {
								throw new Error(`getSetupAuditTrail: record missing key ${k}`);
							}
						}
					}
					return result;
				}
			},
			{
				name: 'runApexTest',
				run: async () => {
					const result = await this.mcpClient.callTool('runApexTest', {
						methodNames: [TEST_CONFIG.salesforce.runApexTestMethodName]
					});
					const sc = result?.structuredContent;
					if (!sc || !Array.isArray(sc.result) || sc.result.length === 0) {
						throw new Error('runApexTest: result array must be non-empty');
					}
					const t = sc.result[0];
					for (const k of ['className', 'methodName', 'status', 'runtime']) {
						if (!(k in t)) {
							throw new Error(`runApexTest: test result missing key ${k}`);
						}
					}
					return result;
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
