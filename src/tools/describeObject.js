import {salesforceState} from '../state.js';
import {runCliCommand, log, notifyProgressChange} from '../utils.js';
import {globalCache} from '../cache.js';

async function describeObject({sObjectName}, _meta) {
	const progressToken = _meta.progressToken;

	try {
		//Validate object name
		if (!sObjectName || typeof sObjectName !== 'string') {
			log('SObject name is invalid:', sObjectName);
			throw new Error('SObject name must be a non-empty string');
		}

		const org = salesforceState.orgDescription.alias;
		const tool = 'describe';
		const key = sObjectName;
		const cached = globalCache.get(org, tool, key);
		if (cached) {
			return cached;
		}

		notifyProgressChange(progressToken, 2, 0, 'Running CLI command...');

		const command = `sf sobject describe --sobject ${sObjectName} -o "${org}" --json`;
		const response = JSON.parse(await runCliCommand(command));

		notifyProgressChange(progressToken, 2, 1, 'Parsing CLI command response...');

		if (response.status !== 0) {
			throw new Error(response.message);

		} else {
			//Filtra només les claus desitjades
			const keys = [
				'childRelationships', 'createable', 'custom', 'deletable', 'fields', 'keyPrefix',
				'label', 'labelPlural', 'name', 'recordTypeInfos', 'searchable', 'urls'
			];
			const fieldKeys = [
				'calculated', 'cascadeDelete', 'createable', 'custom', 'defaultValue', 'digits',
				'encrypted', 'label', 'length', 'name', 'nameField', 'picklistValues', 'filterable',
				'polymorphicForeignKey', 'precision', 'referenceTo', 'relationshipName', 'scale',
				'type', 'updateable'
			];

			const filtered = {};
			for (const k of keys) {
				if (k in response.result) {
					if (k === 'fields') {
						filtered[k] = response.result[k].map(field => {
							const filteredField = {};
							for (const fk of fieldKeys) {
								if (fk in field) {filteredField[fk] = field[fk]}
							}
							return filteredField;
						});
					} else if (k === 'childRelationships') {
						filtered[k] = response.result[k].map(rel => ({
							childSObject: rel.childSObject,
							field: rel.field,
							relationshipName: rel.relationshipName
						}));
					} else {
						filtered[k] = response.result[k];
					}
				}
			}
			const result = {
				content: [{
					type: 'text',
					text: JSON.stringify(filtered)
				}]
			};
			//Desa la resposta al cache centralitzat
			globalCache.set(org, tool, key, result);

			notifyProgressChange(progressToken, 2, 2, 'Done');
			return result;
		}
	} catch (error) {
		log(`Error requesting describe for SObject ${sObjectName}:`, JSON.stringify(error, null, 2));
		return {
			isError: true,
			content: [{
				text: `❌ Error requesting describe for SObject ${sObjectName}: ${error.message}`,
				type: 'text'
			}]
		};
	}
}

export default describeObject;