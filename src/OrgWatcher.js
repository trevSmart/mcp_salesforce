import fs from 'fs';
import path from 'path';
import {EventEmitter} from 'events';
import state from './state.js';
import {createModuleLogger} from './logger.js';
const logger = createModuleLogger(import.meta.url);

class TargetOrgWatcher extends EventEmitter {
	constructor() {
		super();
		this.configFilePath = null;
		this.currentOrgAlias = null;
		this.fileWatcher = null;
		this.isWatching = false;
		this.debounceMs = 5000; // Debounce file system events to reduce noise
		this.debounceTimer = null;
	}

	async start(onChange) {
		try {
			this.configFilePath = path.join(state.workspacePath, '.sf', 'config.json');
			this.currentOrgAlias = state.org?.alias || null;

			if (this.isWatching || !this.currentOrgAlias || !fs.existsSync(this.configFilePath)) {
				return;
			}

			this.on('started', orgAlias => logger.debug(`Monitoring Salesforce CLI target org changes (current: ${orgAlias})`));
			this.on('orgChanged', onChange);
			this.on('error', error => logger.error(error, 'Error in Salesforce CLI target org watcher'));

			this.fileWatcher = fs.watch(path.dirname(this.configFilePath), (eventType, filename) => {
				if (filename === 'config.json' && eventType === 'change') {
					this.debouncedCheck();
				}
			});

			this.isWatching = true;
			this.emit('started', this.currentOrgAlias);

		} catch (error) {
			logger.error(error, 'Error setting up file watcher');
		}
	}

	async stop() {
		if (!this.isWatching) {
			return;
		}

		logger.debug('Stopping Salesforce CLI target org watcher');
		if (this.fileWatcher) {
			this.fileWatcher.close();
			this.fileWatcher = null;
		}
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		this.isWatching = false;
		this.emit('stopped');
	}

	debouncedCheck() {
		this.debounceTimer && clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => this.check(), this.debounceMs);
	}

	check() {
		try {
			const configContent = fs.readFileSync(this.configFilePath, 'utf8');
			const sfConfig = JSON.parse(configContent);
			const newValue = sfConfig['target-org'] || null;

			if (!newValue) {
				logger.debug('No target org found in Salesforce CLI config file');
				return;
			}

			if (newValue !== this.currentOrgAlias) {
				const oldValue = this.currentOrgAlias;
				logger.info(`Change detected in Salesforce CLI target org: ${oldValue} -> ${newValue}`);
				this.currentOrgAlias = newValue;
				this.emit('orgChanged', {oldValue, newValue});
			}

		} catch (error) {
			logger.error(error, 'Error reading Salesforce CLI config file');
		}
	}
}

const targetOrgWatcher = new TargetOrgWatcher();

export default targetOrgWatcher;
