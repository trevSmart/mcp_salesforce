import path from 'node:path';
import {fileURLToPath} from 'node:url';
import client from '../client.js';
import config from '../config.js';

function getLogLevelPrefix(logLevel) {
	const logLevelPrefixes = {
		emergency: '🔥',
		alert: '⛔️',
		critical: '❗️',
		error: '❌',
		warning: '⚠️',
		notice: '✉️',
		info: '💡',
		debug: '🐞'
	};
	return logLevelPrefixes[logLevel] || '❓';
}

// Base sink: sends logs to MCP if available, or stderr fallback
// The SDK now handles log level filtering automatically based on client-set levels
function emitLog(data, logLevel = config.defaultLogLevel, context = null) {
	try {
		// Format the log data
		let logData = data;

		if (data instanceof Error) {
			const errorMessage = context ? `${context}: ${data.message}` : data.message;
			logData = `${errorMessage}\nStack: ${data.stack}`;
		} else {
			if (typeof data === 'object') {
				try {
					logData = JSON.stringify(data, null, 2);
				} catch {
					logData = String(data);
				}
			} else if (typeof data === 'string') {
				logData = data;
			}
			if (context) {
				logData = `${context}: ${logData}`;
			}
		}

		// Truncate long log messages
		if (typeof logData === 'string' && logData.length > 5000) {
			logData = `${logData.slice(0, 4997)}...`;
		}
		if (typeof logData === 'string') {
			logData = `\n${logData}\n`;
		}

		const logPrefix = config.logPrefix ?? '';
		const logLevelPrefix = getLogLevelPrefix(logLevel);
		const mcp = globalThis.__mcpServer;

		// Always attempt to send via MCP if available
		// The SDK will automatically filter based on the client's set log level
		if (mcp?.isConnected() && client?.supportsCapability('logging')) {
			const logger = `${logPrefix}MCP server (${logLevelPrefix})`;
			// Get the current session ID if available
			const sessionId = mcp.server.transport?.getCurrentSessionId?.();

			// Use sendLoggingMessage which respects the client's log level settings
			mcp.server.sendLoggingMessage({
				level: logLevel,
				logger,
				data: logData
			}, sessionId);
		} else {
			// Fallback to console for errors or when MCP is not available
			const errorPriority = 3; // error level
			const LevelPriorities = {
				emergency: 0,
				alert: 1,
				critical: 2,
				error: 3,
				warning: 4,
				notice: 5,
				info: 6,
				debug: 7
			};
			const logPriority = LevelPriorities[logLevel] ?? LevelPriorities.info;

			if (logPriority <= errorPriority) {
				console.error(`${logPrefix} | ${logLevel} | ${logData}`);
			} else {
				console.log(`${logPrefix} | ${logLevel} | ${logData}`);
			}
		}
	} catch (error) {
		console.error(`${config.logPrefix} | [${logLevel}] | ${JSON.stringify(error, null, 3)}`);
	}
}

// Simple logger wrapper to standardize severities across the codebase.
// Usage: const logger = createLogger('mcp-server'); logger.info('message', 'event');
export function createLogger(component = 'app') {
	const map = {error: 'error', warn: 'warning', info: 'info', debug: 'debug'};
	const wrap =
		(level) =>
		(data, event = null) => {
			const context = event ? `${component} · ${event}` : `(${component})`;
			emitLog(data, map[level], context);
		};
	return {
		error: wrap('error'),
		warn: wrap('warn'),
		info: wrap('info'),
		debug: wrap('debug'),
		log(level = 'info', data, event = null) {
			const mapped = map[level] || 'info';
			const context = event ? `${component} · ${event}` : component;
			emitLog(data, mapped, context);
		}
	};
}

// Helper to create a logger using the current module's file name as component
// Example: const logger = createModuleLogger(import.meta.url)
export function createModuleLogger(moduleUrl, fallback = 'app') {
	try {
		const filePath = fileURLToPath(moduleUrl);
		const base = path.basename(filePath).replace(/\.[^.]+$/, '');
		return createLogger(base || fallback);
	} catch {
		return createLogger(fallback);
	}
}
