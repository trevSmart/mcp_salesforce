import {salesforceState} from '../state.js';
import {log, notifyProgressChange} from '../utils.js';
import {globalCache} from '../cache.js';
import {sObjectNameSchema} from './paramSchemas.js';
import {z} from 'zod';
import {describeObjectService} from '../salesforceServices/describeObject.js';

async function describeObjectTool(params, _meta) {
	const schema = z.object({
		sObjectName: sObjectNameSchema,
	});
	const parseResult = schema.safeParse(params);
	if (!parseResult.success) {
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error de validació: ${parseResult.error.message}`
			}]
		};
	}

	const {sObjectName} = params;
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

		//Utilitza el nou servei
		const response = await describeObjectService(sObjectName, org);

		notifyProgressChange(progressToken, 2, 1, 'Parsing CLI command response...');

		if (response.status !== 0) {
			const errorContent = {error: true, message: response.message};
			return {
				isError: true,
				content: [{
					type: 'text',
					text: JSON.stringify(errorContent)
				}],
				structuredContent: errorContent
			};
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
			//Desa la resposta al cache centralitzat
			//Assegura que sempre hi ha les claus requerides per l'outputSchema
			if (!('name' in filtered)) {filtered.name = sObjectName}
			if (!('label' in filtered)) {filtered.label = ''}
			if (!('fields' in filtered)) {filtered.fields = []}
			if (!('recordTypeInfos' in filtered)) {filtered.recordTypeInfos = []}
			globalCache.set(org, tool, key, filtered);

			notifyProgressChange(progressToken, 2, 2, 'Done');
			return {
				content: [{
					type: 'text',
					text: JSON.stringify(filtered)
				}],
				structuredContent: filtered
			};
		}
	} catch (error) {
		log(`Error requesting describe for SObject ${sObjectName}:`, JSON.stringify(error, null, 2));
		const errorContent = {error: true, message: error.message};
		return {
			isError: true,
			content: [{
				type: 'text',
				text: JSON.stringify(errorContent)
			}],
			structuredContent: errorContent
		};
	}
}

export default describeObjectTool;