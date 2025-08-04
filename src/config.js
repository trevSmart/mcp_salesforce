import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

import {log, getAgentInstructions} from './utils.js';

export const SERVER_CONSTANTS = {
	protocolVersion: '2025-06-18',
	serverInfo: {
		name: 'salesforce-mcp',
		version: pkg.version
	},
	capabilities: {
		logging: {},
		resources: {
			//subscribe: true,
			listChanged: true
		},
		prompts: {},
		tools: {},
		completions: {}
	},
	instructions: getAgentInstructions('mcpServer')
};

class Config {
	constructor() {
		this.currentLogLevel = 'debug'; //7: debug, 6: info, 5: notice, 4: warning, 3: error, 2: critical, 1: alert, 0: emergency
		this.logPrefix = '(👁🐝Ⓜ️)';

		this.workspacePath = process.env.WORKSPACE_FOLDER_PATHS || '';
	}

	setLogLevel(level) {
		this.currentLogLevel = level;
	}

	setWorkspacePath(path) {
		//Remove file:// protocol if present
		if (typeof path === 'string' && path.startsWith('file://')) {
			this.workspacePath = path.replace(/^file:\/\//, '');
		} else {
			this.workspacePath = path;
		}

		//Decode URL-encoded characters
		if (this.workspacePath) {
			try {
				this.workspacePath = decodeURIComponent(this.workspacePath);
			} catch (error) {
				log(`Failed to decode workspace path: ${error.message}`, 'warning');
			}
		}

		log(`Workspace path: "${this.workspacePath}"`, 'info');
	}
}

export const config = new Config();