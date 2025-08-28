import {log as baseLog} from './utils.js';

// Simple logger wrapper to standardize severities across the codebase.
// Usage: const logger = createLogger('mcp-server'); logger.info('message', 'event');
export function createLogger(component = 'app') {
	const map = {error: 'error', warn: 'warning', info: 'info', debug: 'debug'};

	const wrap = level => (data, event = null) => {
		const context = event ? `${component} · ${event}` : component;
		baseLog(data, map[level], context);
	};

	return {
		error: wrap('error'),
		warn: wrap('warn'),
		info: wrap('info'),
		debug: wrap('debug')
	};
}

