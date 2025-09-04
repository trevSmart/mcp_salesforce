import {TEST_CONFIG} from '../../test/test-config.js';
import {runSuite} from '../runSuite.js';

export class SalesforceMcpUtilsTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'salesforceMcpUtils getOrgAndUserDetails',
				run: async () => {
					return await this.mcpClient.callTool('salesforceMcpUtils', {
						action: 'getOrgAndUserDetails'
					});
				},
				required: true,
				canRunInParallel: false,
				priority: 'high'
			},
			{
				name: 'salesforceMcpUtils getState',
				run: async () => {
					const result = await this.mcpClient.callTool('salesforceMcpUtils', {
						action: 'getState'
					});
					const sc = result?.structuredContent;
					if (!((sc?.state && sc?.client ) && sc?.resources)) {
						throw new Error('salesforceMcpUtils getState: missing required fields');
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'salesforceMcpUtils loadRecordPrefixesResource',
				run: async () => {
					const result = await this.mcpClient.callTool('salesforceMcpUtils', {
						action: 'loadRecordPrefixesResource'
					});
					const sc = result?.structuredContent;
					if (!sc || typeof sc !== 'object' || Array.isArray(sc)) {
						throw new Error('salesforceMcpUtils loadRecordPrefixesResource: invalid response format');
					}
					if (Object.keys(sc).length === 0) {
						throw new Error('salesforceMcpUtils loadRecordPrefixesResource: empty response');
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'salesforceMcpUtils getCurrentDatetime',
				run: async () => {
					const result = await this.mcpClient.callTool('salesforceMcpUtils', {
						action: 'getCurrentDatetime'
					});
					if (!result?.structuredContent?.datetime) {
						throw new Error('salesforceMcpUtils getCurrentDatetime: missing datetime');
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'salesforceMcpUtils clearCache',
				run: async () => {
					const result = await this.mcpClient.callTool('salesforceMcpUtils', {
						action: 'clearCache'
					});
					if (!result?.structuredContent?.success) {
						throw new Error('salesforceMcpUtils clearCache: cache clear failed');
					}
					return result;
				},
				canRunInParallel: false
			},
			{
				name: 'salesforceMcpUtils reportIssue',
				run: async () => {
					const result = await this.mcpClient.callTool('salesforceMcpUtils', {
						action: 'reportIssue',
						issueDescription: 'Test issue for validation',
						issueToolName: 'testTool'
					});
					if (!result?.structuredContent?.success) {
						throw new Error('salesforceMcpUtils reportIssue: issue report failed');
					}
					if (!result.structuredContent.issueId) {
						throw new Error('salesforceMcpUtils reportIssue: missing issue ID');
					}
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}



await runSuite('salesforceMcpUtils', SalesforceMcpUtilsTestSuite);
