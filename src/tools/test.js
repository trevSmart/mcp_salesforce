import {log} from '../utils.js';
import {notifyProgressChange} from '../utils.js';

async function test(_params, {progressToken}) {
	try {
		log(`Executing test tool with message: ${randomString}`);
		const totalTime = 600000; //10 minutes in milliseconds
		const progressInterval = 10000; //10 seconds in milliseconds
		const startTime = Date.now();

		while (Date.now() - startTime < totalTime) {
			const elapsed = Date.now() - startTime;
			const progress = Math.round(elapsed / totalTime * 100);
			notifyProgressChange(progressToken, 100, progress, 'Test tool is running...');
			await new Promise(resolve => setTimeout(resolve, progressInterval));
		}
		return {
			content: [{
				type: 'text',
				text: '✅ Test tool executed successfully'
			}]
		};
	} catch (error) {
		log('Error in test tool:', JSON.stringify(error, null, 2));
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export default test;