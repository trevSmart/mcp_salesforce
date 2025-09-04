import {TEST_CONFIG} from '../../test/test-config.js';
import {runSuite} from '../runSuite.js';

export class InvokeApexRestResourceTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'invokeApexRestResource GET',
				run: async () => {
					const result = await this.mcpClient.callTool('invokeApexRestResource', {
						apexClassOrRestResourceName: TEST_CONFIG.salesforce.testApexRestResourceData.apexClassOrRestResourceName,
						operation: 'GET'
					});
					if (!result?.structuredContent?.endpoint) {
						throw new Error('invokeApexRestResource: missing endpoint');
					}
					if (!result.structuredContent.request) {
						throw new Error('invokeApexRestResource: missing request details');
					}
					if (!result.structuredContent.response) {
						throw new Error('invokeApexRestResource: missing response');
					}
					if (result.structuredContent.request.method !== 'GET') {
						throw new Error('invokeApexRestResource: expected GET method in request');
					}
					if (typeof result.structuredContent.status !== 'number') {
						throw new Error('invokeApexRestResource: status must be a number');
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'invokeApexRestResource POST',
				run: async () => {
					const result = await this.mcpClient.callTool('invokeApexRestResource', {
						apexClassOrRestResourceName: TEST_CONFIG.salesforce.testApexRestResourceData.apexClassOrRestResourceName,
						operation: 'POST',
						bodyObject: {test: 'data'}
					});
					if (!result?.structuredContent?.endpoint) {
						throw new Error('invokeApexRestResource: missing endpoint');
					}
					if (result.structuredContent.request.method !== 'POST') {
						throw new Error('invokeApexRestResource: expected POST method in request');
					}
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}



await runSuite('invokeApexRestResource', InvokeApexRestResourceTestSuite);
