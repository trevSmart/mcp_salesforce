import {log} from '../utils.js';

async function getCurrentDatetime() {
	return {
		content: [{
			type: 'text',
			text: JSON.stringify({
				now: new Date().toISOString(),
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				timestamp: Date.now()
			}, null, 2)
		}]
	};
}

export default getCurrentDatetime;