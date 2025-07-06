import {deployMetadata} from '../salesforceServices/deployMetadata.js';
import {log} from '../utils.js';

export default async function deployMetadataTool({sourceDir}) {
	try {
		const result = await deployMetadata({sourceDir});
		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(result, null, '\t')
				}
			],
			structuredContent: result
		};
	} catch (error) {
		log(`Error deploying metadata file ${sourceDir}: ${JSON.stringify(error, null, 2)}`);
		return {
			isError: true,
			content: [
				{
					type: 'text',
					text: JSON.stringify(error, null, '\t')
				}
			]
		};
	}
}