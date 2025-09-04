import {TEST_CONFIG} from '../../test/test-config.js';

export class GetSetupAuditTrailTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'getSetupAuditTrail basic',
				run: async () => {
					const result = await this.mcpClient.callTool('getSetupAuditTrail', {
						lastDays: 7
					});
					if (!result?.structuredContent?.filters) {
						throw new Error('getSetupAuditTrail: missing filters');
					}
					if (typeof result.structuredContent.setupAuditTrailFileTotalRecords !== 'number') {
						throw new Error('getSetupAuditTrail: missing total records count');
					}
					if (!Array.isArray(result.structuredContent.records)) {
						throw new Error('getSetupAuditTrail: records must be an array');
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'getSetupAuditTrail with user filter',
				run: async () => {
					const result = await this.mcpClient.callTool('getSetupAuditTrail', {
						lastDays: 14,
						user: TEST_CONFIG.salesforce.testUser
					});
					if (!result?.structuredContent?.filters) {
						throw new Error('getSetupAuditTrail: missing filters');
					}
					if (result.structuredContent.filters.user !== TEST_CONFIG.salesforce.testUser) {
						throw new Error('getSetupAuditTrail: user filter not applied correctly');
					}
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}
