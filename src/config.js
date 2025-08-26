import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

import {getAgentInstructions} from './utils.js';

/**
 * Configuration object for the MCP server
 * @module config
 */
export default {
	logPrefix: '👁🐝Ⓜ️',
	SERVER_CONSTANTS: {
		protocolVersion: '2025-06-18',
		serverInfo: {
			name: 'IBM Salesforce MCP Server',
			alias: 'ibm-sf-mcp',
			version: pkg.version
		},
		capabilities: {
			logging: {},
			resources: {listChanged: true},
			tools: {},
			prompts: {},
			completions: {}
		},
		instructions: getAgentInstructions('agentInstruccions')
	}
};