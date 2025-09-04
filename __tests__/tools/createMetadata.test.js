import {TEST_CONFIG} from '../../test/test-config.js';
import {runSuite} from '../runSuite.js';

export class CreateMetadataTestSuite {
	constructor(mcpClient, quiet = false) {
		this.mcpClient = mcpClient;
		this.quiet = quiet;
	}

	async runTests() {
		const tests = [
			{
				name: 'createMetadata Apex Class',
				run: async () => {
					const result = await this.mcpClient.callTool('createMetadata', {
						type: 'apexClass',
						name: 'TestMCPToolClass'
					});
					if (!result?.structuredContent?.success) {
						throw new Error('createMetadata: creation failed');
					}
					if (!result.structuredContent.files) {
						throw new Error('createMetadata: missing files array');
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'createMetadata Apex Test Class',
				run: async () => {
					const result = await this.mcpClient.callTool('createMetadata', {
						type: 'apexTestClass',
						name: 'TestMCPToolClassTest'
					});
					if (!result?.structuredContent?.success) {
						throw new Error('createMetadata: creation failed');
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'createMetadata Apex Trigger',
				run: async () => {
					const result = await this.mcpClient.callTool('createMetadata', {
						type: 'apexTrigger',
						name: 'TestMCPToolTrigger',
						triggerSObject: 'Account',
						triggerEvent: ['after insert', 'before update']
					});
					if (!result?.structuredContent?.success) {
						throw new Error('createMetadata: creation failed');
					}
					return result;
				},
				canRunInParallel: true
			},
			{
				name: 'createMetadata LWC',
				run: async () => {
					const result = await this.mcpClient.callTool('createMetadata', {
						type: 'lwc',
						name: 'testMCPToolComponent'
					});
					if (!result?.structuredContent?.success) {
						throw new Error('createMetadata: creation failed');
					}
					return result;
				},
				canRunInParallel: true
			}
		];

		return tests;
	}
}



await runSuite('createMetadata', CreateMetadataTestSuite);
