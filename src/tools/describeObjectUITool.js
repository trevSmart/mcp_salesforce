import {log, textFileContent} from '../utils.js';
import {callSalesforceApi} from '../salesforceServices.js';
import {z} from 'zod';
import {newResource, resources} from '../mcp-server.js';

export const describeObjectUIToolDefinition = {
	name: 'describeObjectUI',
	title: 'Describe SObject schema (UI API)',
	description: 'Get SObject schema information using the fast UI API instead of Describe Object. Provides object metadata, fields, record types, and child relationships with better performance.',
	inputSchema: {
		sObjectName: z
			.string()
			.describe('The name of the SObject to describe'),
		include: z
			.enum(['fields', 'record types', 'child relationships', 'all'])
			.describe('The type of information to include in the response: "fields", "record types", "child relationships" or "all"')
			.default('all')
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Describe SObject schema using UI API'
	}
};

export async function describeObjectUITool({sObjectName, include = 'all'}) {
	try {
		const resourceName = 'mcp://mcp/sobject-ui-schema-' + sObjectName.toLowerCase() + '.json';

		// Check cache first
		if (resources[resourceName]) {
			log(`SObject UI schema already cached, skipping fetch`, 'debug');
			const cached = JSON.parse(resources[resourceName].text);
			return {
				content: [{
					type: 'text',
					text: 'Successfully retrieved from cache the SObject UI schema for ' + sObjectName + ' with the following data: ' + JSON.stringify(cached, null, 3)
				}],
				structuredContent: {wasCached: true, ...cached}
			};
		}

		// Fetch from UI API
		const response = await callSalesforceApi('GET', 'UI', `/object-info/${sObjectName}`);

		if (!response || response.error) {
			throw new Error(response?.error?.message || 'Unknown error calling UI API');
		}

		// Transform UI API response to match our expected format
		const transformedData = transformUIApiResponse(response, include);

		// Cache the result if including all information
		if (include === 'all') {
			newResource(
				resourceName,
				`${sObjectName} SObject UI schema`,
				`${sObjectName} SObject UI schema from UI API`,
				'application/json',
				JSON.stringify(transformedData, null, 3),
				{audience: ['assistant', 'user']}
			);
		}

		return {
			content: [{
				type: 'text',
				text: 'Successfully retrieved the SObject UI schema for ' + sObjectName + ' with the following data: ' + JSON.stringify(transformedData, null, 3)
			}],
			structuredContent: transformedData
		};

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

function transformUIApiResponse(uiApiResponse, include) {
	const result = {
		name: uiApiResponse.apiName,
		label: uiApiResponse.label || '',
		labelPlural: uiApiResponse.labelPlural || '',
		keyPrefix: uiApiResponse.keyPrefix || '',
		searchable: uiApiResponse.searchable || false,
		createable: uiApiResponse.createable || false,
		custom: uiApiResponse.custom || false,
		deletable: uiApiResponse.deletable || false,
		updateable: uiApiResponse.updateable || false,
		queryable: uiApiResponse.queryable || false
	};

	// Include fields if requested
	if (include === 'fields' || include === 'all') {
		result.fields = transformFields(uiApiResponse.fields || {});
	}

	// Include record types if requested
	if (include === 'record types' || include === 'all') {
		result.recordTypeInfos = transformRecordTypes(uiApiResponse.recordTypeInfos || {});
	}

	// Include child relationships if requested
	if (include === 'child relationships' || include === 'all') {
		result.childRelationships = transformChildRelationships(uiApiResponse.childRelationships || []);
	}

	return result;
}

function transformFields(uiFields) {
	const transformedFields = [];

	for (const [fieldName, fieldInfo] of Object.entries(uiFields)) {
		const transformedField = {
			name: fieldInfo.apiName || fieldName,
			label: fieldInfo.label || '',
			type: mapDataType(fieldInfo.dataType),
			length: fieldInfo.length || 0,
			createable: fieldInfo.createable || false,
			updateable: fieldInfo.updateable || false,
			custom: fieldInfo.custom || false,
			calculated: fieldInfo.calculated || false,
			nameField: fieldInfo.nameField || false,
			precision: fieldInfo.precision || 0,
			scale: fieldInfo.scale || 0,
			filterable: fieldInfo.filterable || false,
			polymorphicForeignKey: fieldInfo.polymorphicForeignKey || false,
			relationshipName: fieldInfo.relationshipName || null,
			referenceTo: extractReferenceTo(fieldInfo),
			required: fieldInfo.required || false,
			unique: fieldInfo.unique || false,
			externalId: fieldInfo.externalId || false
		};

		// Add additional properties that might be available
		if (fieldInfo.inlineHelpText) {
			transformedField.inlineHelpText = fieldInfo.inlineHelpText;
		}

		if (fieldInfo.controllingFields && fieldInfo.controllingFields.length > 0) {
			transformedField.controllingFields = fieldInfo.controllingFields;
		}

		transformedFields.push(transformedField);
	}

	return transformedFields;
}

function transformRecordTypes(uiRecordTypes) {
	const transformedRecordTypes = [];

	for (const [recordTypeId, recordTypeInfo] of Object.entries(uiRecordTypes)) {
		transformedRecordTypes.push({
			recordTypeId: recordTypeId,
			name: recordTypeInfo.name || '',
			available: recordTypeInfo.available || false,
			master: recordTypeInfo.master || false,
			defaultRecordTypeMapping: recordTypeInfo.defaultRecordTypeMapping || false
		});
	}

	return transformedRecordTypes;
}

function transformChildRelationships(uiChildRelationships) {
	return uiChildRelationships.map(relationship => ({
		childSObject: relationship.childObjectApiName || '',
		field: relationship.fieldName || '',
		relationshipName: relationship.relationshipName || ''
	}));
}

function mapDataType(uiDataType) {
	// Map UI API data types to describe object format
	const typeMapping = {
		'Text': 'string',
		'TextArea': 'textarea',
		'LongTextArea': 'textarea',
		'RichTextArea': 'textarea',
		'Email': 'email',
		'Phone': 'phone',
		'Url': 'url',
		'Checkbox': 'boolean',
		'Currency': 'currency',
		'Number': 'double',
		'Percent': 'percent',
		'Date': 'date',
		'DateTime': 'datetime',
		'Time': 'time',
		'Picklist': 'picklist',
		'MultiselectPicklist': 'multipicklist',
		'Reference': 'reference',
		'MasterDetail': 'reference',
		'Lookup': 'reference',
		'AutoNumber': 'string',
		'Formula': 'string'
	};

	return typeMapping[uiDataType] || uiDataType?.toLowerCase() || 'string';
}

function extractReferenceTo(fieldInfo) {
	if (!fieldInfo.referenceToInfos || fieldInfo.referenceToInfos.length === 0) {
		return [];
	}

	return fieldInfo.referenceToInfos.map(ref => ref.apiName);
}
