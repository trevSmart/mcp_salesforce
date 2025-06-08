class SimpleCache {
	constructor() {
		this.cache = {};
	}

	set(key, value, ttl = 300000) { //5 min per defecte
		this.cache[key] = {
			value,
			expires: Date.now() + ttl
		};
	}

	get(key) {
		const item = this.cache[key];
		if (!item) {return null}

		if (Date.now() > item.expires) {
			delete this.cache[key];
			return null;
		}

		return item.value;
	}

	clear() {
		this.cache = {};
	}
}

export const globalCache = new SimpleCache();