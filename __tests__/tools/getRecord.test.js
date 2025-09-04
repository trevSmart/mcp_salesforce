import {TEST_CONFIG} from '../../test/test-config.js';

export class GetRecordTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'getRecord Account',
				run: async () => {
					const result = await this.mcpClient.callTool('getRecord', {
						sObjectName: 'Account',
						recordId: TEST_CONFIG.salesforce.testAccountId
					});
					if (!result?.structuredContent) {
						throw new Error('getRecord: missing structuredContent');
					}
					if (result.structuredContent.sObject !== 'Account') {
						throw new Error(`getRecord: expected sObject Account, got ${result.structuredContent.sObject}`);
					}
					if (!result.structuredContent.fields) {
						throw new Error('getRecord: missing fields');
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'getRecord Contact',
				run: async () => {
					const result = await this.mcpClient.callTool('getRecord', {
						sObjectName: 'Contact',
						recordId: TEST_CONFIG.salesforce.testContactId
					});
					if (!result?.structuredContent) {
						throw new Error('getRecord: missing structuredContent');
					}
					if (result.structuredContent.sObject !== 'Contact') {
						throw new Error(`getRecord: expected sObject Contact, got ${result.structuredContent.sObject}`);
					}
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}
