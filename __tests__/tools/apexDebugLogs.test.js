import {TEST_CONFIG} from '../../test/test-config.js';
import {runSuite} from '../runSuite.js';

export class ApexDebugLogsTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'apexDebugLogs status',
				run: async () => {
					return await this.mcpClient.callTool('apexDebugLogs', {action: 'status'});
				},
				canRunInParallel: true
			},
			{
				name: 'apexDebugLogs on',
				run: async () => {
					return await this.mcpClient.callTool('apexDebugLogs', {action: 'on'});
				},
				canRunInParallel: false
			},
			{
				name: 'apexDebugLogs list',
				run: async (context) => {
					const result = await this.mcpClient.callTool('apexDebugLogs', {action: 'list'});
					if (!result?.structuredContent?.logs) {
						throw new Error('apexDebugLogs list: missing logs in response');
					}
					if (!Array.isArray(result.structuredContent.logs)) {
						throw new Error('apexDebugLogs list: logs must be an array');
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'apexDebugLogs get',
				run: async (context) => {
					const result = await this.mcpClient.callTool('apexDebugLogs', {action: 'get'});
					if (!result?.structuredContent?.logContent) {
						throw new Error('apexDebugLogs get: missing logContent in response');
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'apexDebugLogs off',
				run: async () => {
					return await this.mcpClient.callTool('apexDebugLogs', {action: 'off'});
				},
				canRunInParallel: false
			}
		];

		return tests;
	}
}



await runSuite('apexDebugLogs', ApexDebugLogsTestSuite);
