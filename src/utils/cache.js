import {log} from '../utils.js';

/**
 * Sistema de cache centralitzat amb TTL configurable
 */
class SimpleCache {
	constructor() {
		this.cache = {};
		this.stats = {
			hits: 0,
			misses: 0,
			sets: 0
		};
	}

	/**
	 * Guarda un valor al cache amb TTL
	 * @param {string} key - Clau única
	 * @param {*} value - Valor a guardar
	 * @param {number} ttl - Time to live en millisegons
	 */
	set(key, value, ttl = 300000) { //5 minuts per defecte
		this.cache[key] = {
			value,
			expires: Date.now() + ttl,
			created: Date.now()
		};
		this.stats.sets++;
		log(`Cache SET: ${key} (TTL: ${ttl}ms)`);
	}

	/**
	 * Recupera un valor del cache
	 * @param {string} key - Clau a buscar
	 * @returns {*|null} - Valor o null si no existeix/ha expirat
	 */
	get(key) {
		const item = this.cache[key];
		if (!item) {
			this.stats.misses++;
			return null;
		}

		if (Date.now() > item.expires) {
			delete this.cache[key];
			this.stats.misses++;
			log(`Cache EXPIRED: ${key}`);
			return null;
		}

		this.stats.hits++;
		log(`Cache HIT: ${key}`);
		return item.value;
	}

	/**
	 * Elimina una clau específica del cache
	 * @param {string} key - Clau a eliminar
	 */
	delete(key) {
		delete this.cache[key];
		log(`Cache DELETE: ${key}`);
	}

	/**
	 * Neteja tot el cache
	 */
	clear() {
		const keysCount = Object.keys(this.cache).length;
		this.cache = {};
		this.stats = {hits: 0, misses: 0, sets: 0};
		log(`Cache CLEAR: ${keysCount} entries removed`);
	}

	/**
	 * Retorna estadístiques del cache
	 */
	getStats() {
		const totalEntries = Object.keys(this.cache).length;
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

	/**
	 * Neteja entrades expirades
	 */
	cleanup() {
		const now = Date.now();
		let cleanedCount = 0;

		for (const [key, item] of Object.entries(this.cache)) {
			if (now > item.expires) {
				delete this.cache[key];
				cleanedCount++;
			}
		}

		if (cleanedCount > 0) {
			log(`Cache CLEANUP: ${cleanedCount} expired entries removed`);
		}

		return cleanedCount;
	}
}

//Instància global del cache
export const globalCache = new SimpleCache();

//TTL constants per a diferents tipus de dades
export const CACHE_TTL = {
	DESCRIBE_OBJECT: 60 * 60 * 1000,      //1 hora - metadades d'objectes
	ORG_USER_DETAILS: 60 * 60 * 1000,     //1 hora - info d'org/usuari
	TOOLING_API_GET: 10 * 60 * 1000,      //10 minuts - metadades via Tooling API
	SETUP_AUDIT: 30 * 60 * 1000,          //30 minuts - audit trail
	DEBUG_STATUS: 2 * 60 * 1000            //2 minuts - estat debug logs
};

//Neteja automàtica cada 15 minuts
setInterval(() => {
	globalCache.cleanup();
}, 15 * 60 * 1000);