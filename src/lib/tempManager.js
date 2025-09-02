import fs from 'node:fs';
import path from 'node:path';
import config from '../config.js';
import {createModuleLogger} from './logger.js';

const logger = createModuleLogger(import.meta.url);

// Get temp directory configuration
function getConfig() {
	const defaults = {
		baseSubdir: 'tmp',
		retentionDays: 7
		// Scheduling disabled by design; cleanup runs opportunistically on writes
	};
	return {...defaults, ...(config?.tempDir || {})};
}

// Get the base temporary directory path
export function getBaseTmpDir() {
	const {baseSubdir} = getConfig();
	return path.join(process.cwd(), baseSubdir);
}

// Ensure the base temporary directory exists
export function ensureBaseTmpDir() {
	const tmpDir = getBaseTmpDir();
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

// Clean up obsolete temporary files
export function cleanupObsoleteTempFiles(options = {}) {
	const baseDir = options.baseDir || ensureBaseTmpDir();
	const retentionDays = options.retentionDays || getConfig().retentionDays;
	const maxAgeMs = Math.max(0, Number(retentionDays)) * 24 * 60 * 60 * 1000;

	if (!(maxAgeMs && fs.existsSync(baseDir))) {
		return {deleted: 0, inspected: 0, baseDir};
	}

	let deleted = 0;
	let inspected = 0;

	try {
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

				// Only clean files, not directories
				if (!stats.isFile()) {
					continue;
				}

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
