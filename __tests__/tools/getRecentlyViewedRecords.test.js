import {TEST_CONFIG} from '../../test/test-config.js';
import {runSuite} from '../runSuite.js';

export class GetRecentlyViewedRecordsTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'getRecentlyViewedRecords',
				run: async () => {
					const result = await this.mcpClient.callTool('getRecentlyViewedRecords', {});
					const sc = result?.structuredContent;
					if (!sc?.records) {
						throw new Error('getRecentlyViewedRecords: missing records in response');
					}
					if (!Array.isArray(sc.records)) {
						throw new Error('getRecentlyViewedRecords: records must be an array');
					}
					if (typeof sc.totalSize !== 'number') {
						throw new Error('getRecentlyViewedRecords: totalSize must be a number');
					}
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}



await runSuite('getRecentlyViewedRecords', GetRecentlyViewedRecordsTestSuite);
