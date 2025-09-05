import {TEST_CONFIG} from '../../test/test-config.js';
import {runSuite} from '../runSuite.js';

export class DmlOperationTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'dmlOperation create',
				run: async () => {
					const result = await this.mcpClient.callTool('dmlOperation', {
						operations: {
							create: [
								{
									sObjectName: 'Account',
									fields: {
										// biome-ignore lint/style/useNamingConvention: Salesforce field names must be PascalCase
										Name: 'Test MCP Tool Account',
										// biome-ignore lint/style/useNamingConvention: Salesforce field names must be PascalCase
										Description: 'Account created by MCP tool test'
									}
								}
							]
						}
					});
					if (!result?.structuredContent?.outcome) {
						throw new Error('dmlOperation: missing outcome');
					}
					if (!result.structuredContent.successes) {
						throw new Error('dmlOperation: missing successes array');
					}
					return result;
				}
			},
			{
				name: 'dmlOperation update',
				run: async () => {
					const result = await this.mcpClient.callTool('dmlOperation', {
						operations: {
							update: [
								{
									sObjectName: 'Account',
									recordId: TEST_CONFIG.salesforce.testAccountId,
									fields: {
										// biome-ignore lint/style/useNamingConvention: Salesforce field names must be PascalCase
										Description: `Updated by MCP Tool test at ${new Date().toISOString()}`
									}
								}
							]
						}
					});
					if (!result?.structuredContent?.outcome) {
						throw new Error('dmlOperation: missing outcome');
					}
					return result;
				}
			}
		];

		return tests;
	}
}

await runSuite('dmlOperation', DmlOperationTestSuite);
