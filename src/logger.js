import {CONFIG} from './config.js';

const LOG_LEVEL_PRIORITY = {info: 0, debug: 1, warn: 2, error: 3};

export function log(message, logLevel = 'info') {
	if (LOG_LEVEL_PRIORITY[logLevel] < LOG_LEVEL_PRIORITY[CONFIG.currentLogLevel]) {
		return;
	}

	if (typeof message === 'object') {
		message = JSON.stringify(message, null, '\t');
	}
	if (message && message.length > 1000) {
		message = message.slice(0, 1000) + '...';
	}
	console.error(message);
}