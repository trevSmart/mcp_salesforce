import {log, textFileContent} from '../utils.js';
import {callSalesforceApi} from '../salesforceServices.js';
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
		excludeFields: z
			.boolean()
			.describe('If true, excludes fields from the response (faster processing, smaller response). If false, includes all data including fields.')
			.default(false)
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Describe SObject schema'
	}
};

export async function describeObjectTool({sObjectName, excludeFields = false}) {
	try {
		const resourceName = 'mcp://mcp/sobject-ui-schema-' + sObjectName.toLowerCase() + '.json';

		// Check cache first
		if (resources[resourceName]) {
			log(`SObject schema already cached, skipping fetch`, 'debug');
			const cached = JSON.parse(resources[resourceName].text);

			// Apply filtering to cached data
			const filteredData = applyFiltering(cached, excludeFields);

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
		const transformedData = transformUIApiResponse(response, 'all'); // Always get all data

		// Apply filtering
		const filteredData = applyFiltering(transformedData, excludeFields);

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

function applyFiltering(data, excludeFields) {
	if (!excludeFields) {
		return data; // Include everything
	}

	// Exclude fields when excludeFields is true
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
		// Fields are excluded when excludeFields is true
	};

	return result;
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
			custom: fieldInfo.custom || false,
			relationshipName: fieldInfo.relationshipName || null,
			referenceTo: extractReferenceTo(fieldInfo),
			required: fieldInfo.required || false,
			unique: fieldInfo.unique || false,
			externalId: fieldInfo.externalId || false
		};

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
