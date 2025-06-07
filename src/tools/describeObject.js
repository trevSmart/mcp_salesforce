import {getOrgDescription} from '../../index.js';
import {runCliCommand} from '../utils.js';

//Cache in-memory per a les descripcions d'objectes
const describeCache = {};
const CACHE_TTL_MS = 60 * 60 * 1000; //1 hora en mil·lisegons

async function describeObject({sObjectName}) {
	try {
		//Validate object name
		if (!sObjectName || typeof sObjectName !== 'string') {
			console.error('SObject name is invalid:', sObjectName);
			throw new Error('SObject name must be a non-empty string');
		}

		//Comprova si ja tenim la descripció al cache i si és vàlida
		const cached = describeCache[sObjectName];
		if (cached) {
			const now = Date.now();
			if (now - cached.timestamp < CACHE_TTL_MS) {
				console.error('Returning cached describe for', sObjectName);
				return cached.result;
			} else {
				console.error('Cache expired for', sObjectName, 'refreshing...');
				delete describeCache[sObjectName];
			}
		}

		const command = `sf sobject describe --sobject ${sObjectName} -o ${getOrgDescription().alias} --json`;
		console.error(`Executing describe command: ${command}`);
		const response = await runCliCommand(command);
		console.error('Raw CLI response:', response);
		const result = {
			content: [{
				type: 'text',
				text: `✅ SObject ${sObjectName} described successfully: ${JSON.stringify(response, null, '\t')}`
			}]
		};
		//Desa la resposta al cache amb timestamp
		describeCache[sObjectName] = {result, timestamp: Date.now()};
		return result;

	} catch (error) {
		console.error('Error object (raw):', error);
		console.error('Error.message:', error.message);
		console.error('Error.stack:', error.stack);
		try {
			console.error('Error (stringified):', JSON.stringify(error));
		} catch (e) {
			console.error('Error serializing error object:', e.message);
		}
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export {describeObject};