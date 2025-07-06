import fs from 'fs';
import path, {dirname} from 'path';
import {fileURLToPath} from 'url';
import {log} from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const CACHE_ENABLED = false;

class GlobalCache {
	EXPIRATION_TIME = {
		TOOLING_API_GET: 300000, //5 minutes
		ORG_USER_DETAILS: 300000, //5 minutes
		REFRESH_SOBJECT_DEFINITIONS: 1200000, //20 minutes
		DESCRIBE_SOBJECT_RESULT: 300000, //5 minutes
		TOOLING_API_REQUEST: 300000, //5 minutes
		UPDATE_SF_CLI: 604800000 //1 week
	};

	constructor() {
		this.cache = {};
		this.cacheFile = path.join(PROJECT_ROOT, 'tmp', 'cache.json');
		this.stats = {hits: 0, misses: 0, sets: 0};
		this._loadFromFile();
		//Periodic cleanup of expired entries every 15 minutes
		setInterval(() => this.cleanup(), 15 * 60 * 1000);
	}

	set(org, tool, key, value, ttl = 300000) {
		if (!CACHE_ENABLED || !org) {
			return;
		}

		if (!this.cache[org]) {this.cache[org] = {}}
		if (!this.cache[org][tool]) {this.cache[org][tool] = {}}
		this.cache[org][tool][key] = {
			value,
			expires: Date.now() + ttl,
			created: Date.now()
		};
		this.stats.sets++;
		this._saveToFile();
	}

	get(org, tool, key) {
		if (!CACHE_ENABLED || !org) {
			return null;
		}

		const item = this.cache?.[org]?.[tool]?.[key];
		if (!item) {
			this.stats.misses++;
			return null;
		}
		if (Date.now() > item.expires) {
			delete this.cache[org][tool][key];
			this.stats.misses++;
			this._saveToFile();
			return null;
		}
		this.stats.hits++;
		return item.value;
	}

	delete(org, tool, key) {
		if (this.cache?.[org]?.[tool]?.[key]) {
			delete this.cache[org][tool][key];
			this._saveToFile();
		}
	}

	clear(deleteFile = false) {
		this.cache = {};
		this.stats = {hits: 0, misses: 0, sets: 0};
		try {
			if (fs.existsSync(this.cacheFile)) {
				fs.unlinkSync(this.cacheFile);
			}
		} catch (err) {
			log('[CACHE] Error deleting cache file: ' + err, 'error');
		}
		this._saveToFile(deleteFile);
	}

	getStats() {
		let totalEntries = 0;
		for (const org of Object.keys(this.cache)) {
			for (const tool of Object.keys(this.cache[org])) {
				totalEntries += Object.keys(this.cache[org][tool]).length;
			}
		}
		const hitRate = this.stats.hits + this.stats.misses > 0
			? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
			: 0;
		return {
			totalEntries,
			hits: this.stats.hits,
			misses: this.stats.misses,
			sets: this.stats.sets,
			hitRate: `${hitRate}%`
		};
	}

	cleanup() {
		const now = Date.now();
		let cleanedCount = 0;
		for (const org of Object.keys(this.cache)) {
			for (const tool of Object.keys(this.cache[org])) {
				for (const key of Object.keys(this.cache[org][tool])) {
					const item = this.cache[org][tool][key];
					if (now > item.expires) {
						delete this.cache[org][tool][key];
						cleanedCount++;
					}
				}
			}
		}
		if (cleanedCount > 0) {
			this._saveToFile();
		}
		return cleanedCount;
	}

	_saveToFile(deleteFile = false) {
		try {
			fs.mkdirSync(path.dirname(this.cacheFile), {recursive: true});
			//Only save non-expired entries
			const now = Date.now();
			const cacheToSave = {};
			for (const org of Object.keys(this.cache)) {
				cacheToSave[org] = {};
				for (const tool of Object.keys(this.cache[org])) {
					cacheToSave[org][tool] = {};
					for (const key of Object.keys(this.cache[org][tool])) {
						const item = this.cache[org][tool][key];
						if (now <= item.expires) {
							cacheToSave[org][tool][key] = item;
						}
					}
				}
			}
			//If the cache is completely empty, delete the file if it exists and exit
			const isEmpty = Object.keys(cacheToSave).length === 0 || Object.values(cacheToSave).every(orgObj => Object.keys(orgObj).length === 0);
			if (isEmpty && deleteFile) {
				if (fs.existsSync(this.cacheFile)) {
					fs.unlinkSync(this.cacheFile);
				}
				return;
			}

			fs.writeFileSync(this.cacheFile, JSON.stringify(cacheToSave, null, 2), 'utf8');
		} catch (err) {
			log('[CACHE] Error saving cache: ' + err, 'error');
		}
	}

	_loadFromFile() {
		try {
			if (fs.existsSync(this.cacheFile)) {
				const data = fs.readFileSync(this.cacheFile, 'utf8');
				const loaded = JSON.parse(data);
				//Only load non-expired entries
				const now = Date.now();
				for (const org of Object.keys(loaded)) {
					if (!this.cache[org]) {this.cache[org] = {}}
					for (const tool of Object.keys(loaded[org])) {
						if (!this.cache[org][tool]) {this.cache[org][tool] = {}}
						for (const key of Object.keys(loaded[org][tool])) {
							const item = loaded[org][tool][key];
							if (now <= item.expires) {
								this.cache[org][tool][key] = item;
							}
						}
					}
				}
			} else {
				log('[CACHE] _loadFromFile: file does not exist', 'info');
			}
		} catch (err) {
			log('[CACHE] Error loading cache: ' + err, 'error');
		}
	}
}

export const globalCache = new GlobalCache();