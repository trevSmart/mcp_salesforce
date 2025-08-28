import {z} from 'zod';
import {describeObject} from '../salesforceServices.js';
import {log, textFileContent, getAgentInstructions} from '../utils.js';
import {mcpServer} from '../mcp-server.js';

export const generateSoqlQueryToolDefinition = {
	name: 'generateSoqlQuery',
	title: 'Generate SOQL Query',
	description: textFileContent('generateSoqlQuery'),
	inputSchema: {
		soqlQueryDescription: z
			.string()
			.describe('The description of the SOQL query to generate'),
		/*
		involvedSObjects: z
			.array(z.string())
			.describe('The SObjects involved in the query (e.g. ["Account", "Contact"])')
		*/
		involvedFields: z
			.array(z.string())
			.describe('The fields involved in the query (e.g. ["Case.AccountId", "Case.Account.Birthdate", "Contact.CreatedBy.Name"])')
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Generate SOQL Query'
	}
};

export async function generateSoqlQueryToolHandler({soqlQueryDescription, involvedFields}) {

	try {
		if (!soqlQueryDescription) {
			throw new Error('soqlQueryDescription is required');
		}

		if (!involvedFields || !Array.isArray(involvedFields) || involvedFields.length === 0) {
			throw new Error('involvedFields array is required and must contain at least one field');
		}

		// Extract SObject names from involvedFields
		const sObjectNames = [...new Set(involvedFields.map(field => {
			const parts = field.split('.');
			return parts[0];
		}))];

		const descObjResults = await Promise.all(
			sObjectNames.map(async sObjectName => {
				const descObjResult = (await describeObject(sObjectName)).result;

				if (!descObjResult?.fields) {
					throw new Error(`The 'fields' property was not found in the object description for ${sObjectName}`);
				}
				const childRelationships = descObjResult.childRelationships
					.map(childRelationship => ({
						childSObject: childRelationship.childSObject,
						field: childRelationship.field
					}));

				const fields = [];
				for (const f of descObjResult.fields) {
					const field = {
						label: f.label,
						name: f.name,
						type: f.type,
						referenceTo: f.referenceTo,
						relationshipName: f.relationshipName,
						calculated: f.calculated,
						sortable: f.sortable,
						encrypted: f.encrypted,
						filterable: f.filterable,
						polymorphic: f.polymorphicForeignKey
					};
					f.picklistValues.length && (field.picklistValues = f.picklistValues);
					fields.push(field);
				}

				const recordTypeInfos = descObjResult.recordTypeInfos
					.filter(recordType => recordType.active)
					.map(recordType => ({
						name: recordType.name,
						developerName: recordType.developerName
					}));

				return {
					name: descObjResult.name, label: descObjResult.label,
					childRelationships, fields, recordTypeInfos
				};
			})
		);

		// Build the prompt using soqlQueryDescription and the schema information
		let samplingPrompt = `## Query Description ##\n${soqlQueryDescription}\n\n## Schema Information ##\n`;

		descObjResults.forEach((describeResult, index) => {
			const sObjectName = sObjectNames[index];

			//Start building the samplingPrompt with the new agreed format
			samplingPrompt += `## ${sObjectName} schema ##`;

			samplingPrompt += '\n\n### Child Relationships ###';
			describeResult.childRelationships.forEach(child => {
				samplingPrompt += `\n  - \`${child.field}\`: "${child.field}" → \`${child.childSObject}\``;
			});

			samplingPrompt += '\n\n### Fields ###';

			const fieldGroups = {
				'Lookup': [],
				'Text': [],
				'Numeric': [],
				'Picklist': [],
				'Boolean': [],
				'Date/Time': []
			};

			//Group fields by type
			describeResult.fields.forEach(field => {
				const fieldLineBase = `    - \`${field.name}\`: "${field.label}"`;
				if (field.type === 'reference') {
					fieldGroups.Lookup.push(`${fieldLineBase} → \`${field.referenceTo.join(' / ')}\``);
				} else if (['string', 'textarea', 'email', 'phone', 'url'].includes(field.type)) {
					fieldGroups.Text.push(`${fieldLineBase} [${field.type}]`);
				} else if (['int', 'double', 'currency', 'percent'].includes(field.type)) {
					fieldGroups.Numeric.push(`${fieldLineBase}`);
				} else if (field.type === 'picklist') {
					let picklistValues = '';
					if (field.picklistValues) {
						const values = field.picklistValues.map(v => `"${v.value}"`).join(', ');
						picklistValues = `\n        Values: ${values}`;
					}
					fieldGroups.Picklist.push(`${fieldLineBase}${picklistValues}`);
				} else if (field.type === 'boolean') {
					fieldGroups.Boolean.push(`${fieldLineBase}`);
				} else if (['date', 'datetime'].includes(field.type)) {
					fieldGroups['Date/Time'].push(`${fieldLineBase}`);
				}
			});

			//Append grouped fields
			Object.entries(fieldGroups).forEach(([groupName, fields]) => {
				if (fields.length > 0) {
					samplingPrompt += `\n- #### ${groupName} ####`;
					fields.forEach(line => {
						samplingPrompt += `\n${line}`;
					});
				}
			});

			samplingPrompt += '\n\n### Record Types ###';
			describeResult.recordTypeInfos.forEach(recordType => {
				samplingPrompt += `\n  - \`${recordType.developerName}\`: "${recordType.name}"`;
			});
		});

		const samplingResponse = await mcpServer.server.createMessage({
			messages: [{role: 'user', content: {type: 'text', text: samplingPrompt}}],
			systemPrompt: getAgentInstructions('generateSoqlQueryToolSampling'),
			modelPreferences: {speedPriority: 0, intelligencePriority: 1},
			maxTokens: 3000
		});

		return {
			content: [{
				type: 'text',
				text: samplingResponse.content.text
			}],
			structuredContent: samplingResponse
		};

	} catch (error) {
		log(error, 'error');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}
