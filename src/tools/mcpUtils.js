import {globalCache} from '../cache.js';
import {log} from '../utils.js';

async function salesforceMcpUtils({action}) {
	try {
		if (action === 'clearCache') {
			globalCache.clear(true);
		} else if (action === 'refreshSObjectDefinitions') {
			runCliCommand('sf sobject definitions refresh');
		} else {
			throw new Error(`Invalid action: ${action}`);
		}
		return {
			content: [{
				type: 'text',
				text: `✅ Action "${action}" executed successfully`
			}]
		};

	} catch (error) {
		log(`Error executing action "${action}":`, JSON.stringify(error, null, 2));
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export default salesforceMcpUtils;