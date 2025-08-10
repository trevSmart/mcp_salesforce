import {z} from 'zod';
import {describeObject} from '../salesforceServices.js';
import {log, textFileContent, getAgentInstructions} from '../utils.js';
import {mcpServer} from '../mcp-server.js';

export const generateSoqlQueryToolDefinition = {
	name: 'generateSoqlQuery',
	title: 'Generate SOQL Query',
	description: textFileContent('generateSoqlQueryTool'),
	inputSchema: {
		soqlQueryDescription: z
			.string()
			.describe('The description of the SOQL query to generate'),
		involvedSObjects: z
			.array(z.string())
			.describe('The SObjects involved in the query (e.g. ["Account", "Contact"])')
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Generate SOQL Query'
	}
};

export async function generateSoqlQueryTool({soqlQueryDescription, involvedSObjects}) {
	try {
		if (typeof involvedSObjects === 'string') {
			involvedSObjects = involvedSObjects.split(',').map(s => s.trim());
		} else if (!Array.isArray(involvedSObjects)) {
			involvedSObjects = Object.values(involvedSObjects);
		}

		const descObjResults = await Promise.all(
			involvedSObjects.map(async sObjectName => {
				const descObjResult = (await describeObject(sObjectName)).result;

				if (!descObjResult?.fields) {
					throw new Error(`No s'ha trobat la propietat 'fields' a la descripció de l'objecte ${sObjectName}`);
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
						polymorphic: f.polymorphicForeignKey,
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

		//Demana  al LLM que generi la SOQL basant-se en soqlQueryDescription + els describeObjectResults
		let samplingPrompt = 'Write a SOQL query sentence.\n\n';
		samplingPrompt += `Description:\n${soqlQueryDescription}`;

		descObjResults.forEach((describeResult, index) => {
			const sObjectName = involvedSObjects[index];
			samplingPrompt += `\n\n--- ${sObjectName} Schema ---`;
			samplingPrompt += '\nFields:';
			describeResult.fields.forEach(field => {
				samplingPrompt += `\n  - ${field.name} (${field.type})${field.referenceTo ? ` -> ${field.referenceTo.join(', ')}` : ''}${field.relationshipName ? ` [${field.relationshipName}]` : ''}`;
			});
			if (describeResult.recordTypeInfos && describeResult.recordTypeInfos.length > 0) {
				samplingPrompt += '\nRecord Types:';
				describeResult.recordTypeInfos.forEach(recordType => {
					samplingPrompt += `\n  - ${recordType.name} (${recordType.developerName})`;
				});
			}
		});

		const samplingResponse = await mcpServer.server.createMessage({
			messages: [{role: 'user', content: {type: 'text', text: samplingPrompt}}],
			systemPrompt: getAgentInstructions('generateSoqlQueryToolSampling'),
			modelPreferences: {speedPriority: 0, intelligencePriority: 1},
			maxTokens: 500
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