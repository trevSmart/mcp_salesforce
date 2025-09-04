import {TEST_CONFIG} from '../../test/test-config.js';

export class GenerateSoqlQueryTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'generateSoqlQuery basic',
				run: async () => {
					const result = await this.mcpClient.callTool('generateSoqlQuery', {
						query: 'Get all accounts with their contacts'
					});
					const sc = result?.structuredContent;
					if (!sc?.content?.[0]?.text) {
						throw new Error('generateSoqlQuery: missing content or text in response');
					}
					// Verify the generated query contains expected elements
					const generatedQuery = sc.content[0].text;
					const hasSelect = generatedQuery.includes('SELECT');
					const hasFrom = generatedQuery.includes('FROM');
					const isValidQuery = hasSelect && hasFrom;
					if (!isValidQuery) {
						throw new Error('generateSoqlQuery: generated query missing basic SOQL structure');
					}
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}
