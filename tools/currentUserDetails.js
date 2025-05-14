/*globals process */
import {getUserDescription} from '../index.js';

async function currentUserDetails(args, _meta) {
	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify(getUserDescription(), null, '\t')
			}
		]
	};
}

export {currentUserDetails};