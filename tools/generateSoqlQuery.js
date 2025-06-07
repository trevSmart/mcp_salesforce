import {callSalesforceAPI} from '../src/utils.js';
import {describeObject} from './describeObject.js';

async function generateSoqlQuery({soqlQueryDescription, involvedSObjects}) {
	console.error('soqlQueryDescription: ' + soqlQueryDescription);
	console.error('involvedSObjects 1: ' + involvedSObjects);
	try {
		if (typeof involvedSObjects === 'string') {
			involvedSObjects = involvedSObjects.split(',').map(s => s.trim());
		} else if (!Array.isArray(involvedSObjects)) {
			involvedSObjects = Object.values(involvedSObjects);
		}
		console.error('involvedSObjects 2: ' + involvedSObjects);

		const  describeSObjectResults = await Promise.all(
			involvedSObjects.map(async sObjectName => {
				const result = await describeObject({sObjectName});
				const match = result.content[0].text.match(/\{.*\}$/s);
				if (match) {
					const fullDesc = JSON.parse(match[0]);
					//Filter fields to keep only the specified keys
					const filteredFields = (fullDesc.fields || []).map(field => ({
						label: field.label,
						name: field.name,
						type: field.type,
						referenceTo: field.referenceTo,
						relationshipName: field.relationshipName,
						sortable: field.sortable
					}));
					return {
						fields: filteredFields,
						recordTypeInfos: fullDesc.recordTypeInfos
					};
				} else {
					throw new Error(`Could not parse the description of the object ${sObjectName}`);
				}
			})
		);

		//Minificar el JSON de describeSObjectResults
		const minifiedDescribeSObjectResults = JSON.parse(JSON.stringify(describeSObjectResults));

		//Build the body for the prompt template call according to the new structure
		const body = {
			isPreview: 'false',
			inputParams: {
				valueMap: {
					'Input:soqlQueryDescription': {
						value: typeof soqlQueryDescription === 'string' ? soqlQueryDescription : soqlQueryDescription.soqlQueryDescription || ''
					},
					'Input:describeSObjectResults': {
						value: JSON.stringify(minifiedDescribeSObjectResults)
					}
				}
			},
			additionalConfig: {
				numGenerations: 1,
				temperature: 0,
				frequencyPenalty: 0,
				presencePenalty: 0,
				additionalParameters: {},
				applicationName: 'PromptBuilderPreview'
			}
		};

		//Hacer la llamada POST al endpoint de acciones personalizadas
		const response = await callSalesforceAPI(
			'POST',
			null,
			'/einstein/prompt-templates/generateSoqlQueryToolPrompt/generations',
			body
		);

		return {
			content: [{
				type: 'text',
				text: response.generations[0].text
			}]
		};

	} catch (error) {
		console.error('Error in generateSoqlQuery:', error);
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export {generateSoqlQuery};