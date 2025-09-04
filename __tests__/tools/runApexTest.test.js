import {TEST_CONFIG} from '../../test/test-config.js';

export class RunApexTestTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'runApexTest by class',
				run: async () => {
					const result = await this.mcpClient.callTool('runApexTest', {
						classNames: ['TestMCPToolTest']
					});
					if (!result?.structuredContent?.result) {
						throw new Error('runApexTest: missing result array');
					}
					if (!Array.isArray(result.structuredContent.result)) {
						throw new Error('runApexTest: result must be an array');
					}
					if (result.structuredContent.result.length > 0) {
						const testResult = result.structuredContent.result[0];
						if (!(testResult.className && testResult.methodName && testResult.status)) {
							throw new Error('runApexTest: missing required fields in test result');
						}
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'runApexTest by method',
				run: async () => {
					const result = await this.mcpClient.callTool('runApexTest', {
						methodNames: ['TestMCPToolTest.testMethod']
					});
					if (!result?.structuredContent?.result) {
						throw new Error('runApexTest: missing result array');
					}
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}
