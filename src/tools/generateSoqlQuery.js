import {callSalesforceAPI, log} from '../utils.js';
import describeObject from './describeObject.js';

async function generateSoqlQuery({soqlQueryDescription, involvedSObjects}) {

	try {
		if (typeof involvedSObjects === 'string') {
			involvedSObjects = involvedSObjects.split(',').map(s => s.trim());
		} else if (!Array.isArray(involvedSObjects)) {
			involvedSObjects = Object.values(involvedSObjects);
		}


		const describeSObjectResults = await Promise.all(
			involvedSObjects.map(async sObjectName => {
				const result = await describeObject({sObjectName});
				log('DESCRIBE OBJECT RESULT:');
				log(JSON.stringify(result, null, '\t'));
				let sObjDesc = result;
				if (result.content && result.content[0] && result.content[0].text) {
					try {
						sObjDesc = JSON.parse(result.content[0].text);
					} catch (parseError) {
						log(`Error parsing JSON for ${sObjectName}:`, parseError);
						throw new Error(`Error parsing JSON for ${sObjectName}: ${parseError.message}`);
					}
				} else {
					log(`Warning: 'content[0]' or 'text' property is missing in the result for ${sObjectName}`);
					throw new Error(`Missing 'content[0]' or 'text' property in the result for ${sObjectName}`);
				}
				if (!sObjDesc.fields) {
					throw new Error(`No s'ha trobat la propietat 'fields' a la descripció de l'objecte ${sObjectName}`);
				}
				const filteredFields = (sObjDesc.fields || []).map(field => ({
					label: field.label,
					name: field.name,
					type: field.type,
					referenceTo: field.referenceTo,
					relationshipName: field.relationshipName,
					sortable: field.sortable
				}));
				return {
					fields: filteredFields,
					recordTypeInfos: sObjDesc.recordTypeInfos
				};
			})
		);

		//Minify the JSON describeSObjectResults
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
		log('Error in generateSoqlQuery:', error);
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export default generateSoqlQuery;