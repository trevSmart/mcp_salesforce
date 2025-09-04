import {TEST_CONFIG} from '../../test/test-config.js';
import {runSuite} from '../runSuite.js';

export class DescribeObjectTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'describeObject Account',
				run: async () => {
					const result = await this.mcpClient.callTool('describeObject', {
						sObjectName: 'Account'
					});
					if (!result?.structuredContent) {
						throw new Error('describeObject: missing structuredContent');
					}
					if (result.structuredContent.name !== 'Account') {
						throw new Error(`describeObject: expected name Account, got ${result.structuredContent.name}`);
					}
					if (!Array.isArray(result.structuredContent.fields) || result.structuredContent.fields.length === 0) {
						throw new Error('describeObject: fields must be a non-empty array');
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'describeObject Contact',
				run: async () => {
					const result = await this.mcpClient.callTool('describeObject', {
						sObjectName: 'Contact'
					});
					if (!result?.structuredContent) {
						throw new Error('describeObject: missing structuredContent');
					}
					if (result.structuredContent.name !== 'Contact') {
						throw new Error(`describeObject: expected name Contact, got ${result.structuredContent.name}`);
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'describeObject with includeFields false',
				run: async () => {
					const result = await this.mcpClient.callTool('describeObject', {
						sObjectName: 'Account',
						includeFields: false
					});
					if (!result?.structuredContent) {
						throw new Error('describeObject: missing structuredContent');
					}
					if (result.structuredContent.wasCached !== true) {
						throw new Error('describeObject: expected wasCached to be true when includeFields is false');
					}
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}



await runSuite('describeObject', DescribeObjectTestSuite);
