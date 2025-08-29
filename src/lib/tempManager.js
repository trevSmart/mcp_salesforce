import fs from 'fs';
import path from 'path';
import config from '../config.js';
import {createModuleLogger} from './logger.js';

const logger = createModuleLogger(import.meta.url);

function getConfig() {
	const defaults = {
		baseSubdir: 'tmp',
		retentionDays: 7
		// Scheduling disabled by design; cleanup runs opportunistically on writes
	};
	const userCfg = (config && config.tempDir) ? config.tempDir : {};
	return {
		...defaults,
		...userCfg
	};
}

export function getBaseTmpDir(workspacePath = null) {
	const base = workspacePath && typeof workspacePath === 'string' ? workspacePath : process.cwd();
	const {baseSubdir} = getConfig();
	return path.join(base, baseSubdir);
}

export function ensureBaseTmpDir(workspacePath = null) {
	const tmpDir = getBaseTmpDir(workspacePath);
	try {
		if (!fs.existsSync(tmpDir)) {
			fs.mkdirSync(tmpDir, {recursive: true});
			logger.debug(`Created tmp directory: ${tmpDir}`);
		}
	} catch (error) {
		logger.error(error, `Failed to ensure tmp directory: ${tmpDir}`);
	}
	return tmpDir;
}

export function cleanupObsoleteTempFiles(options = {}) {
	const {retentionDays, baseDir} = {
		retentionDays: getConfig().retentionDays,
		baseDir: options.baseDir || ensureBaseTmpDir()
	};
	const maxAgeMs = Math.max(0, Number(retentionDays)) * 24 * 60 * 60 * 1000;
	if (!maxAgeMs) {
		return {deleted: 0, inspected: 0, baseDir};
	}

	let deleted = 0;
	let inspected = 0;

	try {
		if (!fs.existsSync(baseDir)) {
			return {deleted: 0, inspected: 0, baseDir};
		}

		const entries = fs.readdirSync(baseDir);
		const now = Date.now();
		for (const entry of entries) {
			// Skip dotfiles or known keep files
			if (entry === '.gitkeep' || entry.startsWith('.')) {
				continue;
			}
			const fullPath = path.join(baseDir, entry);
			try {
				const stats = fs.statSync(fullPath);
				inspected++;
				if (!stats.isFile()) {
					continue;
				} // only clean files, not directories
				const ageMs = now - stats.mtimeMs;
				if (ageMs > maxAgeMs) {
					fs.unlinkSync(fullPath);
					deleted++;
				}
			} catch (err) {
				logger.debug(err, `Skipping ${fullPath} during cleanup`);
			}
		}
	} catch (error) {
		logger.error(error, 'Temp cleanup failed');
	}

	if (deleted > 0) {
		logger.info(`Temp cleanup: deleted ${deleted} obsolete file(s) from ${baseDir}`);
	} else {
		logger.debug(`Temp cleanup: nothing to delete in ${baseDir}`);
	}
	return {deleted, inspected, baseDir};
}

// Scheduling intentionally omitted; cleanup is performed on-demand at write time
