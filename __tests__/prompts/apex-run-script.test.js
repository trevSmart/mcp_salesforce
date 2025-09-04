import {TEST_CONFIG} from '../../test/test-config.js';
import {runSuite} from '../runSuite.js';

export class ApexRunScriptPromptTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'apex-run-script prompt',
				run: async () => {
					const result = await this.mcpClient.callPrompt('apex-run-script', {
						currentBehavior: 'Current code does nothing',
						desiredBehavior: 'Code should return a greeting message',
						updateTests: 'Yes'
					});
					const hasMessages = result?.messages;
					const isArray = Array.isArray(result?.messages);
					const isValidMessages = hasMessages && isArray;
					if (!isValidMessages) {
						throw new Error('apex-run-script prompt: missing messages array');
					}
					if (result.messages.length === 0) {
						throw new Error('apex-run-script prompt: empty messages array');
					}
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}



await runSuite('apex-run-script', ApexRunScriptPromptTestSuite);
