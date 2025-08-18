import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

import { getAgentInstructions } from './utils.js';

let workspacePath = process.env.WORKSPACE_FOLDER_PATHS || '';

class Config {
	constructor() {
		this.logPrefix = '👁🐝Ⓜ️';
	}

	get SERVER_CONSTANTS() {
		return {
			protocolVersion: '2025-06-18',
			serverInfo: {
				name: 'salesforce-mcp',
				version: pkg.version
			},
			capabilities: {
				logging: {},
				resources: { listChanged: true },
				// prompts: {},
				tools: {},
				completions: {}
			},
			instructions: getAgentInstructions('mcpServer')
		};
	}

	get workspacePath() {
		return workspacePath;
	}

	set workspacePath(newWorkspacePath) {
		workspacePath = newWorkspacePath;
	}
}

export default new Config();