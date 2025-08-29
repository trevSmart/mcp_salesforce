import {spawn, execSync} from 'child_process';
import {fileURLToPath} from 'url';
import {dirname, resolve} from 'path';
import {TEST_CONFIG} from './test-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// MCP Server management
export class MCPServerManager {
	constructor(quiet = false) {
		this.serverProcess = null;
		this.quiet = quiet;
	}

	async start() {
		if (!this.quiet) {
			console.log(`\n${TEST_CONFIG.colors.blue}Starting MCP server...${TEST_CONFIG.colors.reset}`);
		}


		// Ensure test runs never create real GitHub issues via webhook
		const env = {...process.env};
		if (typeof env.MCP_REPORT_ISSUE_DRY_RUN === 'undefined') {
			env.MCP_REPORT_ISSUE_DRY_RUN = 'true';
		}

		this.serverProcess = spawn('node', [resolve(__dirname, TEST_CONFIG.mcpServer.serverPath)], {
			stdio: ['pipe', 'pipe', 'pipe'],
			cwd: resolve(__dirname, '..'),
			env
		});

		this.serverProcess.stderr.on('data', (data) => {
			console.error(`${TEST_CONFIG.colors.red}[STDERR]${TEST_CONFIG.colors.reset}\n`, data.toString());
		});

		this.serverProcess.on('error', (error) => {
			console.error(`${TEST_CONFIG.colors.red}Failed to start server:${TEST_CONFIG.colors.reset}`, error);
		});

		this.serverProcess.on('close', (code) => {
			if (!this.quiet) {
				console.log(`${TEST_CONFIG.colors.yellow}Server process exited with code ${code}${TEST_CONFIG.colors.reset}`);
			}
		});

		// Wait for server to start
		await new Promise(resolveTimeout => setTimeout(resolveTimeout, TEST_CONFIG.mcpServer.startupDelay));
	}

	async stop() {
		if (this.serverProcess) {
			this.serverProcess.kill();
			this.serverProcess = null;
		}
	}

	getProcess() {
		return this.serverProcess;
	}
}

// Salesforce org management
export class SalesforceOrgManager {
	static getCurrentOrg() {
		try {
			const result = execSync('sf config get target-org --json', {encoding: 'utf8'});
			const config = JSON.parse(result);
			return config.result?.[0]?.value || null;
		} catch (error) {
			console.error(`  ${TEST_CONFIG.colors.red}Error getting current org:${TEST_CONFIG.colors.reset}`, error.message);
			return null;
		}
	}

	static setTargetOrg(alias, quiet = false) {
		try {
			execSync(`sf config set target-org "${alias}" --global`, {encoding: 'utf8'});
			if (!quiet) {
				console.log(`  ${TEST_CONFIG.colors.cyan}✓ Switched to org: ${alias}${TEST_CONFIG.colors.reset}`);
			}
			return true;
		} catch (error) {
			console.error(`  ${TEST_CONFIG.colors.red}Error switching to org ${alias}:${TEST_CONFIG.colors.reset}`, error.message);
			return false;
		}
	}

	static async ensureTestOrg(quiet = false) {
		const currentOrg = this.getCurrentOrg();
		const testOrg = TEST_CONFIG.salesforce.testOrgAlias;

		if (!quiet) {
			console.log(`  ${TEST_CONFIG.colors.cyan}Current org: ${currentOrg || 'none'}. Test org: ${testOrg}${TEST_CONFIG.colors.reset}.`);
		}

		if (currentOrg === testOrg) {
			if (!quiet) {
				console.log(`  ${TEST_CONFIG.colors.green}Already in test org${TEST_CONFIG.colors.reset}`);
			}
			return null; // No need to restore
		}

		if (!quiet) {
			console.log(`  ${TEST_CONFIG.colors.yellow}Switching to test org...${TEST_CONFIG.colors.reset}`);
		}
		if (this.setTargetOrg(testOrg, quiet)) {
			return currentOrg; // Return original org to restore later
		} else {
			throw new Error(`Failed to switch to test org: ${testOrg}`);
		}
	}

	static restoreOriginalOrg(originalOrg, quiet = false) {
		if (!originalOrg) {
			if (!quiet) {
				console.log(`${TEST_CONFIG.colors.blue}No original org to restore${TEST_CONFIG.colors.reset}`);
			}
			return;
		}

		if (!quiet) {
			console.log(`${TEST_CONFIG.colors.yellow}Restoring original org: ${originalOrg}${TEST_CONFIG.colors.reset}`);
		}
		if (this.setTargetOrg(originalOrg, quiet)) {
			if (!quiet) {
				console.log(`${TEST_CONFIG.colors.green}✓ Restored original org${TEST_CONFIG.colors.reset}`);
			}
		} else {
			console.error(`${TEST_CONFIG.colors.red}Failed to restore original org${TEST_CONFIG.colors.reset}`);
		}
	}
}

// Test utility functions
export class TestHelpers {
	static logNotification(level, text) {
		const color = {
			emergency: TEST_CONFIG.colors.red,
			alert: TEST_CONFIG.colors.red,
			critical: TEST_CONFIG.colors.red,
			error: TEST_CONFIG.colors.red,
			warning: TEST_CONFIG.colors.yellow,
			notice: TEST_CONFIG.colors.green,
			info: TEST_CONFIG.colors.cyan,
			debug: TEST_CONFIG.colors.pink
		}[level] || TEST_CONFIG.colors.reset;

		console.log(`${color}[${level.toUpperCase()}]${TEST_CONFIG.colors.reset} ${text}`);
	}

	static formatDuration(startTime) {
		const durationMs = Date.now() - startTime;
		const durationSeconds = (durationMs / 1000).toFixed(2);
		return `${durationSeconds}s`;
	}

	static getTestStatus(success) {
		return success ?
			`${TEST_CONFIG.colors.green}✓ PASS${TEST_CONFIG.colors.reset}` :
			`${TEST_CONFIG.colors.red}✗ FAIL${TEST_CONFIG.colors.reset}`;
	}

	static parseCommandLineArgs() {
		const args = {};
		process.argv.slice(2).forEach(arg => {
			if (arg.startsWith('--')) {
				const [key, value] = arg.substring(2).split('=');
				args[key] = value || true;
			}
		});
		return args;
	}
}
