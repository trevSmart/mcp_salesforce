import {getOrgDescription} from '../../index.js';
import {runCliCommand, log} from '../utils.js';

//Cache in-memory per a les descripcions d'objectes
const describeCache = {};
const CACHE_TTL_MS = 60 * 60 * 1000; //1 hora en mil·lisegons

async function describeObject({sObjectName}) {
	try {
		//Validate object name
		if (!sObjectName || typeof sObjectName !== 'string') {
			log('SObject name is invalid:', sObjectName);
			throw new Error('SObject name must be a non-empty string');
		}

		//Comprova si ja tenim la descripció al cache i si és vàlida
		const cached = describeCache[sObjectName];
		if (cached) {
			const now = Date.now();
			if (now - cached.timestamp < CACHE_TTL_MS) {
				log('Returning cached describe for', sObjectName);
				return cached.result;
			} else {
				log('Cache expired for', sObjectName, 'refreshing...');
				delete describeCache[sObjectName];
			}
		}

		const command = `sf sobject describe --sobject ${sObjectName} -o ${getOrgDescription().alias} --json`;
		const response = JSON.parse(await runCliCommand(command));
		if (response.status !== 0) {
			throw new Error(response.message);
		} else {
			//Filtra només les claus desitjades
			const keys = [
				'childRelationships',
				'createable',
				'custom',
				'deletable',
				'fields',
				'keyPrefix',
				'label',
				'labelPlural',
				'name',
				'recordTypeInfos',
				'searchable',
				'urls'
			];
			const filtered = {};
			for (const k of keys) {
				if (k in response.result) {filtered[k] = response.result[k]}
			}
			const result = {
				content: [{
					type: 'text',
					text: JSON.stringify(filtered, null, 2)
				}]
			};
			//Desa la resposta al cache amb timestamp
			describeCache[sObjectName] = {result, timestamp: Date.now()};
			return result;
		}
	} catch (error) {
		log(`Error requesting describe for SObject ${sObjectName}:`, JSON.stringify(error, null, 2));
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error requesting describe for SObject ${sObjectName}: ${error.message}`
			}]
		};
	}
}

export default describeObject;