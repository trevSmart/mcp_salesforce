import {TEST_CONFIG} from '../../test/test-config.js';
import {runSuite} from '../runSuite.js';

export class GetApexClassCodeCoverageTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'getApexClassCodeCoverage',
				run: async () => {
					const result = await this.mcpClient.callTool('getApexClassCodeCoverage', {
						classNames: ['TestMCPTool']
					});
					if (!result?.structuredContent?.classes) {
						throw new Error('getApexClassCodeCoverage: missing classes array');
					}
					if (!Array.isArray(result.structuredContent.classes)) {
						throw new Error('getApexClassCodeCoverage: classes must be an array');
					}
					if (result.structuredContent.classes.length > 0) {
						const classCoverage = result.structuredContent.classes[0];
						if (!classCoverage.className || typeof classCoverage.percentage !== 'number') {
							throw new Error('getApexClassCodeCoverage: missing required fields in class coverage');
						}
					}
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}



await runSuite('getApexClassCodeCoverage', GetApexClassCodeCoverageTestSuite);
