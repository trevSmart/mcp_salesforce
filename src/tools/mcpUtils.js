import {globalCache} from '../cache.js';
import {log} from '../utils.js';

async function clearCache() {
	try {
		globalCache.clear(true);
		return {
			content: [{
				type: 'text',
				text: '✅ Cache cleared successfully'
			}]
		};

	} catch (error) {
		log('Error clearing cache:', JSON.stringify(error, null, 2));
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export default clearCache;