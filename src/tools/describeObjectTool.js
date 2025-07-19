import {log, textFileContent} from '../utils.js';
//import {globalCache} from '../cache.js';
import {describeObject} from '../salesforceServices.js';
import {z} from 'zod';

export const describeObjectToolDefinition = {
	name: 'describeObject',
	title: 'Describe Object',
	description: textFileContent('describeObjectTool'),
	inputSchema: {
		sObjectName: z
			.string()
			.describe('The name of the SObject to describe'),
		include: z
			.enum(['fields', 'record types', 'child relationships', 'all'])
			.describe('The type of information to include in the response: "fields", "record types", "child relationships" or "all"')
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Describe Object'
	}
};

export async function describeObjectTool({sObjectName, include = 'all'}) {
	try {
		if (!sObjectName) {
			throw new Error('SObject name must be a non-empty string');
		}

		//Validate object name
		if (!sObjectName || typeof sObjectName !== 'string') {
			log('SObject name is invalid:', sObjectName);
			throw new Error('SObject name must be a non-empty string');
		}

		/*const cached = globalCache.get('describeObject', sObjectName);
		if (cached) {
			return cached;
		} */

		const response = await describeObject(sObjectName);

		if (response.status !== 0) {
			throw new Error(response.message);

		} else {
			//Filtra només les claus desitjades
			let keys = ['name', 'label', 'labelPlural', 'keyPrefix', 'searchable', 'createable', 'custom', 'deletable'];

			if (include === 'fields' || include === 'all') {
				keys.push('fields');
			}
			if (include === 'record types' || include === 'all') {
				keys.push('recordTypeInfos');
			}
			if (include === 'child relationships' || include === 'all') {
				keys.push('childRelationships');
			}

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
							relationshipName: rel.relationshipNamem || ''
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
			//globalCache.set('describeObject', sObjectName, filtered);

			return {
				content: [{
					type: 'text',
					text: 'Successfully retrieved the SObject schema for ' + sObjectName + ' with the following data: ' + JSON.stringify(filtered)
				}],
				structuredContent: filtered
			};
		}

	} catch (error) {
		log(`Error requesting describe for SObject ${sObjectName}: ${error.message}`, 'error');
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