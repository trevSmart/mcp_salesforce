import {TEST_CONFIG} from '../../test/test-config.js';
import {runSuite} from '../runSuite.js';

export class ChatWithAgentforceTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'chatWithAgentforce basic',
				run: async () => {
					const result = await this.mcpClient.callTool('chatWithAgentforce', {
						message: 'Hello, can you help me with Salesforce?'
					});
					const sc = result?.structuredContent;
					if (!sc?.data) {
						throw new Error('chatWithAgentforce: missing data in structuredContent');
					}
					// Check if we got a response (either success or error is valid)
					if (!result.content?.[0]?.text) {
						throw new Error('chatWithAgentforce: missing content in response');
					}
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}



await runSuite('chatWithAgentforce', ChatWithAgentforceTestSuite);
