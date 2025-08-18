import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { log } from './utils.js';
import state from './state.js';
import config from './config.js';

class TargetOrgWatcher extends EventEmitter {
    constructor() {
        super();
        this.configFilePath = null;
        this.currentOrgAlias = null;
        this.fileWatcher = null;
        this.isWatching = false;
        this.debounceMs = 2000; // Debounce file system events to reduce noise
        this.debounceTimer = null;
    }

    async start(onChange) {
        try {
            this.configFilePath = path.join(config.workspacePath, '.sf', 'config.json');
            this.currentOrgAlias = state.org?.alias || null;

            if (this.isWatching || !this.currentOrgAlias || !fs.existsSync(this.configFilePath)) {
                return;
            }

            // this.addExitHandlers();  // exit handlers removed to speed up shutdown

            this.on('started', orgAlias => log(`Monitoring Salesforce CLI target org changes (current: ${orgAlias})`, 'debug'));
            this.on('orgChanged', onChange);
            this.on('error', error => log(error, 'error', 'Error in Salesforce CLI target org watcher'));

            this.fileWatcher = fs.watch(path.dirname(this.configFilePath), (eventType, filename) => {
                if (filename === 'config.json' && eventType === 'change') {
                    this.debouncedCheck();
                }
            });

            this.isWatching = true;
            this.emit('started', this.currentOrgAlias);

        } catch (error) {
            log(error, 'error', 'Error setting up file watcher');
        }
    }

    async stop() {
        if (!this.isWatching) {
            return;
        }

        log('Stopping Salesforce CLI target org watcher', 'debug');
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
                log('No target org found in Salesforce CLI config file', 'debug');
                return;
            }

            if (newValue !== this.currentOrgAlias) {
                const oldValue = this.currentOrgAlias;
                log(`Change detected in Salesforce CLI target org: ${oldValue} -> ${newValue}`, 'info');
                this.currentOrgAlias = newValue;
                this.emit('orgChanged', { oldValue, newValue });
            }
        } catch (error) {
            log(error, 'error', 'Error reading Salesforce CLI config file');
        }
    }

    addExitHandlers() {
        process.on('SIGINT', () => {
            targetOrgWatcher.stop();
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            targetOrgWatcher.stop();
            process.exit(0);
        });
    }
}

const targetOrgWatcher = new TargetOrgWatcher();

export default targetOrgWatcher;