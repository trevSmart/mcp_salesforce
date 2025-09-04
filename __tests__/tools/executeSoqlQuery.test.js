import {TEST_CONFIG} from '../../test/test-config.js';

export class ExecuteSoqlQueryTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'executeSoqlQuery',
				run: async () => {
					const result = await this.mcpClient.callTool('executeSoqlQuery', {
						query: 'SELECT Id, Name FROM Account LIMIT 3'
					});
					const sc = result?.structuredContent;
					if (!(sc && Array.isArray(sc.records))) {
						throw new Error('executeSoqlQuery: records must be an array');
					}
					if (sc.records.length > 0) {
						const r = sc.records[0];
						if (!(r.Id && r.Name)) {
							throw new Error('executeSoqlQuery: first record must include Id and Name');
						}
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'executeSoqlQuery with Tooling API',
				run: async () => {
					const result = await this.mcpClient.callTool('executeSoqlQuery', {
						query: 'SELECT Id, Name FROM ApexClass LIMIT 3',
						useToolingApi: true
					});
					const sc = result?.structuredContent;
					if (!(sc && Array.isArray(sc.records))) {
						throw new Error('executeSoqlQuery Tooling API: records must be an array');
					}
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}
