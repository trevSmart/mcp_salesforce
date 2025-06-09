import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import {log} from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

class GlobalCache {

	EXPIRATION_TIME = {
		TOOLING_API_GET: 300000, //5 minuts
		ORG_USER_DETAILS: 300000, //5 minuts
		REFRESH_SOBJECT_DEFINITIONS: 1200000, //20 minuts
		DESCRIBE_SOBJECT_RESULT: 300000, //5 minuts
		TOOLING_API_REQUEST: 300000 //5 minuts
	};

	constructor() {
		this.cache = {};
		console.error('[CACHE] PROJECT_ROOT:', PROJECT_ROOT);
		this.cacheFile = path.join(PROJECT_ROOT, 'tmp', 'cache.json');
		this.stats = {hits: 0, misses: 0, sets: 0};
		log('[CACHE] Constructor. Ruta fitxer:', this.cacheFile);
		this._loadFromFile();
		//Neteja periòdica d'entrades expirades cada 15 minuts
		setInterval(() => this.cleanup(), 15 * 60 * 1000);
	}

	set(org, tool, key, value, ttl = 300000) {
		log(`[CACHE] SET org=${org} tool=${tool} key=${key}`);
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
		log(`[CACHE] GET org=${org} tool=${tool} key=${key}`);
		const item = this.cache?.[org]?.[tool]?.[key];
		if (!item) {
			this.stats.misses++;
			log('[CACHE] MISS');
			return null;
		}
		if (Date.now() > item.expires) {
			delete this.cache[org][tool][key];
			this.stats.misses++;
			log('[CACHE] EXPIRED');
			this._saveToFile();
			return null;
		}
		this.stats.hits++;
		log('[CACHE] HIT');
		return item.value;
	}

	delete(org, tool, key) {
		log(`[CACHE] DELETE org=${org} tool=${tool} key=${key}`);
		if (this.cache?.[org]?.[tool]?.[key]) {
			delete this.cache[org][tool][key];
			this._saveToFile();
		}
	}

	clear() {
		log('[CACHE] CLEAR');
		this.cache = {};
		this.stats = {hits: 0, misses: 0, sets: 0};
		this._saveToFile();
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
		log('[CACHE] CLEANUP');
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
			log(`[CACHE] CLEANUP: ${cleanedCount} entrades expirades eliminades`);
		}
		return cleanedCount;
	}

	_saveToFile() {
		log('[CACHE] _saveToFile INICI');
		log(`[CACHE] _saveToFile INICI. Ruta: ${this.cacheFile}`);
		try {
			fs.mkdirSync(path.dirname(this.cacheFile), {recursive: true});
			//Només guardem entrades no expirades
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
			fs.writeFileSync(this.cacheFile, JSON.stringify(cacheToSave, null, 2), 'utf8');
			log('[CACHE] _saveToFile OK');
		} catch (err) {
			log('[CACHE] Error guardant la caché:', err);
		}
	}

	_loadFromFile() {
		log('[CACHE] _loadFromFile INICI');
		try {
			if (fs.existsSync(this.cacheFile)) {
				const data = fs.readFileSync(this.cacheFile, 'utf8');
				const loaded = JSON.parse(data);
				//Només carreguem entrades no expirades
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
				log('[CACHE] _loadFromFile OK');
			} else {
				log('[CACHE] _loadFromFile: fitxer no existeix');
			}
		} catch (err) {
			log('[CACHE] Error carregant la caché:', err);
		}
	}
}

export const globalCache = new GlobalCache();