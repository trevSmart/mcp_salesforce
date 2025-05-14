/*globals process */
import {getOrgDescription} from '../index.js';

async function orgDetails(args, _meta) {
	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify(getOrgDescription(), null, '\t')
			}
		]
	};
}

export {orgDetails};