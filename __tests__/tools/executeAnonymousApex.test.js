import {TEST_CONFIG} from '../../test/test-config.js';

export class ExecuteAnonymousApexTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'executeAnonymousApex simple',
				run: async () => {
					const result = await this.mcpClient.callTool('executeAnonymousApex', {
						apexCode: "System.debug('Hello from MCP tool test');\nSystem.debug('Current time: ' + Datetime.now());",
						mayModify: false
					});
					if (!result?.structuredContent?.success) {
						throw new Error('executeAnonymousApex: execution failed');
					}
					if (!result.structuredContent.debugLogs) {
						throw new Error('executeAnonymousApex: missing debug logs');
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'executeAnonymousApex with modification',
				run: async () => {
					const result = await this.mcpClient.callTool('executeAnonymousApex', {
						apexCode: "Account acc = new Account(Name='Test Account');\ninsert acc;\nSystem.debug('Created account: ' + acc.Id);",
						mayModify: true
					});
					if (!result?.structuredContent?.success) {
						throw new Error('executeAnonymousApex: execution failed');
					}
					return result;
				},
				canRunInParallel: false
			}
		];

		return tests;
	}
}
