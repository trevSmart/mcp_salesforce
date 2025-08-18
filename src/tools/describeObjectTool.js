import {log, textFileContent} from '../utils.js';
import {describeObject} from '../salesforceServices.js';
import {z} from 'zod';
import {newResource, resources} from '../mcp-server.js';

export const describeObjectToolDefinition = {
	name: 'describeObject',
	title: 'Describe SObject schema',
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
		title: 'Describe SObject schema'
	}
};

export async function describeObjectTool({sObjectName, include = 'all'}) {
	try {
		const resourceName = 'mcp://mcp/sobject-schema-' + sObjectName.toLowerCase() + '.json';
		if (resources[resourceName]) {
			log(`SObject schema already cached, skipping fetch`, 'debug');
			const filtered = JSON.parse(resources[resourceName].text);
			return {
				content: [{
					type: 'text',
					text: 'Successfully retrieved from cache the SObject schema for ' + sObjectName + ' with the following data: ' + JSON.stringify(filtered, null, 3)
				}],
				structuredContent: {wasCached: true, ...filtered}
			};
		}
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
							relationshipName: rel.relationshipName || ''
						}));
					} else {
						filtered[k] = response.result[k];
					}
				}
			}
			//Assegura que sempre hi ha les claus requerides per l'outputSchema
			if (!('name' in filtered)) {
				filtered.name = sObjectName;
			}
			if (!('label' in filtered)) {
				filtered.label = '';
			}
			if (!('fields' in filtered)) {
				filtered.fields = [];
			}
			if (!('recordTypeInfos' in filtered)) {
				filtered.recordTypeInfos = [];
			}

			if (include === 'all') {
				newResource(
					resourceName,
					`${sObjectName} SObject schema`,
					`${sObjectName} SObject schema`,
					'application/json',
					JSON.stringify(filtered, null, 3),
					{audience: ['assistant', 'user']}
				);
			}

			return {
				content: [{
					type: 'text',
					text: 'Successfully retrieved the SObject schema for ' + sObjectName + ' with the following data: ' + JSON.stringify(filtered, null, 3)
				}],
				structuredContent: filtered
			};
		}

	} catch (error) {
		log(error, 'error');
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