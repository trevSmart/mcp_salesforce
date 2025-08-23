import {log, textFileContent} from '../utils.js';
import {callSalesforceApi} from '../salesforceServices.js';
import {z} from 'zod';
import {newResource, resources} from '../mcp-server.js';

export const describeObjectToolDefinition = {
	name: 'describeObject',
	title: 'Describe SObject schema',
	description: textFileContent('describeObject'),
	inputSchema: {
		sObjectName: z
			.string()
			.describe('The name of the SObject to describe'),
		includeFields: z
			.boolean()
			.describe('If true, includes fields in the response. If false, excludes fields for faster processing and smaller response.')
			.default(true),
		includePicklistValues: z
			.boolean()
			.describe('If true, includes picklist values for picklist and multipicklist fields. If false, only field metadata is returned.')
			.default(false)
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Describe SObject schema'
	}
};

export async function describeObjectToolHandler({sObjectName, includeFields = true, includePicklistValues = false}) {
	try {
		const resourceName = 'mcp://mcp/sobject-ui-schema-' + sObjectName.toLowerCase() + '.json';

		// Check cache first
		if (resources[resourceName]) {
			log('SObject schema already cached, skipping fetch', 'debug');
			const cached = JSON.parse(resources[resourceName].text);

			// Apply filtering to cached data
			const filteredData = applyFiltering(cached, includeFields, includePicklistValues);

			return {
				content: [{
					type: 'text',
					text: 'Successfully retrieved from cache the SObject schema for ' + sObjectName + ' with the following data: ' + JSON.stringify(filteredData, null, 3)
				}],
				structuredContent: {wasCached: true, ...filteredData}
			};
		}

		// Fetch from UI API
		const response = await callSalesforceApi('GET', 'UI', `/object-info/${sObjectName}`);

		if (!response || response.error) {
			throw new Error(response?.error?.message || 'Unknown error calling UI API');
		}

		// Transform UI API response to match our expected format
		const transformedData = transformUIApiResponse(response, 'all', includePicklistValues); // Pass includePicklistValues

		// Apply filtering
		const filteredData = applyFiltering(transformedData, includeFields, includePicklistValues);

		// Cache the result (always cache the full data)
		newResource(
			resourceName,
			`${sObjectName} SObject schema`,
			`${sObjectName} SObject schema`,
			'application/json',
			JSON.stringify(transformedData, null, 3),
			{audience: ['assistant', 'user']}
		);

		return {
			content: [{
				type: 'text',
				text: 'Successfully retrieved the SObject schema for ' + sObjectName + ' with the following data: ' + JSON.stringify(filteredData, null, 3)
			}],
			structuredContent: filteredData
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

function applyFiltering(data, includeFields, includePicklistValues) {
	if (includeFields) {
		// Include everything including fields
		const result = {...data};

		// If includePicklistValues is true, ensure picklist values are included
		if (includePicklistValues && result.fields) {
			result.fields = transformFields(result.fields, includePicklistValues);
		}

		return result;
	}

	// Exclude fields when includeFields is false
	const result = {
		name: data.name,
		label: data.label,
		labelPlural: data.labelPlural,
		keyPrefix: data.keyPrefix,
		searchable: data.searchable,
		createable: data.createable,
		custom: data.custom,
		deletable: data.deletable,
		updateable: data.updateable,
		queryable: data.queryable,
		// Include record types and relationships (lightweight)
		recordTypeInfos: data.recordTypeInfos || [],
		childRelationships: data.childRelationships || []
		// Fields are excluded when includeFields is false
	};

	// If includePicklistValues is true, we need to include fields to get picklist values
	// This overrides the includeFields behavior for picklist values
	if (includePicklistValues && data.fields) {
		result.fields = transformFields(data.fields, includePicklistValues);
	}

	return result;
}

function transformUIApiResponse(uiApiResponse, include, includePicklistValues) {
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
		result.fields = transformFields(uiApiResponse.fields || {}, includePicklistValues);
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

function transformFields(uiFields, includePicklistValues) {
	const transformedFields = [];

	for (const [fieldName, fieldInfo] of Object.entries(uiFields)) {
		const transformedField = {
			name: fieldInfo.apiName || fieldName,
			label: fieldInfo.label || '',
			type: mapDataType(fieldInfo.dataType),
			length: fieldInfo.length || 0,
			custom: fieldInfo.custom || false,
			relationshipName: fieldInfo.relationshipName || null,
			referenceTo: extractReferenceTo(fieldInfo),
			required: fieldInfo.required || false,
			unique: fieldInfo.unique || false,
			externalId: fieldInfo.externalId || false
		};

		// Include picklist values if requested
		if (includePicklistValues && (fieldInfo.dataType === 'Picklist' || fieldInfo.dataType === 'MultiselectPicklist')) {
			transformedField.picklistValues = transformPicklistValues(fieldInfo.picklistValues || []);
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
			available: recordTypeInfo.available || false
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

function transformPicklistValues(uiPicklistValues) {
	const transformedValues = [];

	// UI API returns picklist values as an array of objects with 'value' and 'label' properties
	if (Array.isArray(uiPicklistValues)) {
		for (const picklistValue of uiPicklistValues) {
			transformedValues.push({
				value: picklistValue.value || '',
				label: picklistValue.label || picklistValue.value || ''
			});
		}
	} else if (typeof uiPicklistValues === 'object' && uiPicklistValues !== null) {
		// Fallback: if it's an object, try to extract values
		for (const [value, label] of Object.entries(uiPicklistValues)) {
			transformedValues.push({
				value: value,
				label: label || value
			});
		}
	}

	return transformedValues;
}
