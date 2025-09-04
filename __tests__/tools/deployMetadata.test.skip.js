import {TEST_CONFIG} from '../../test/test-config.js';
import {runSuite} from '../runSuite.js';

export class DeployMetadataTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'deployMetadata validation only',
				run: async () => {
					// This test only validates the tool exists and can be called
					// Actual deployment is not tested to avoid destructive operations
					const result = await this.mcpClient.callTool('deployMetadata', {
						sourceDir: 'force-app/main/default/classes/TestClass.cls'
					});
					if (!result) {
						throw new Error('deployMetadata: tool call failed');
					}
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}



await runSuite('deployMetadata', DeployMetadataTestSuite);
