import {TEST_CONFIG} from '../../test/test-config.js';
import {runSuite} from '../runSuite.js';

export class TriggerExecutionOrderTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'triggerExecutionOrder basic',
				run: async () => {
					const result = await this.mcpClient.callTool('triggerExecutionOrder', {
						sObjectName: 'Account'
					});
					if (!result?.structuredContent) {
						throw new Error('triggerExecutionOrder: missing structuredContent');
					}
					// This tool might be disabled or return minimal data
					// Just verify the tool exists and can be called
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}



await runSuite('triggerExecutionOrder', TriggerExecutionOrderTestSuite);
