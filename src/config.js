import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

import { log, getAgentInstructions } from './utils.js';
import { fileURLToPath } from 'url';

export const SERVER_CONSTANTS = {
	protocolVersion: '2025-06-18',
	serverInfo: {
		name: 'salesforce-mcp',
		version: pkg.version
	},
	capabilities: {
		logging: {},
		resources: { listChanged: true },
		prompts: {},
		tools: {},
		completions: {}
	},
	instructions: getAgentInstructions('mcpServer')
};

class Config {
	constructor() {
		this.currentLogLevel = process.env.LOG_LEVEL || 'info'; //7: debug, 6: info, 5: notice, 4: warning, 3: error, 2: critical, 1: alert, 0: emergency
		this.logPrefix = '👁🐝Ⓜ️';

		this.workspacePath = process.env.WORKSPACE_FOLDER_PATHS || '';
	}

	setLogLevel(level) {
		this.currentLogLevel = level;
	}

	setWorkspacePath(inputPath) {
		// Normalize file:// URIs to local filesystem paths
		if (typeof inputPath === 'string' && inputPath.startsWith('file://')) {
			try {
				// Robust conversion for any platform
				this.workspacePath = fileURLToPath(inputPath);
			} catch (error) {
				// Fallback: strip protocol safely leaving leading slash on POSIX
				this.workspacePath = inputPath.replace(/^file:\/\//, '');
				try {
					this.workspacePath = decodeURIComponent(this.workspacePath);
				} catch (decodeError) {
					log(`Failed to decode workspace path: ${decodeError.message}`, 'error');
				}
				// Ensure POSIX absolute path keeps leading slash
				if (process.platform !== 'win32' && !this.workspacePath.startsWith('/')) {
					this.workspacePath = '/' + this.workspacePath;
				}
				// Windows drive letter normalization if needed
				if (process.platform === 'win32' && this.workspacePath.startsWith('/')) {
					this.workspacePath = this.workspacePath.replace(/^\/([a-zA-Z]):/, '$1:');
				}
			}
		} else {
			this.workspacePath = inputPath;
		}

		log(`Workspace path: "${this.workspacePath}"`, 'info');
	}
}

export const config = new Config();
