import {getOrgDescription} from '../index.js';
import {runCliCommand} from './utils.js';

/**
 * Retorna l'ordre d'execució dels components d'automatització per un SObject i operació
 * @param {Object} arguments Arguments de la tool
 * @param {string} arguments.sObjectName Nom del SObject
 * @param {string} arguments.operation Operació DML (insert, update o delete)
 * @returns {Promise<Object>} Resultat de l'execució
 */
async function triggerExecutionOrder(args) {
	const sObjectName = args.sObjectName;
	const operation = args.operation.toLowerCase();

	if (!['insert', 'update', 'delete'].includes(operation.toLowerCase())) {
		throw new Error('Operation must be one of: insert, update, delete');
	}

	//1. Obtenim els triggers
	const triggersQuery = `SELECT Id, Name, TableEnumOrId, Body, ApiVersion, Status
							FROM ApexTrigger
							WHERE TableEnumOrId = '${sObjectName}'
							AND Status = 'Active'`;
	const triggers = await runCliCommand(`sf data query -t -q "${triggersQuery}" -o ${getOrgDescription().alias} --json`);

	//2. Obtenim els Process Builders
	const processQuery = `SELECT Id, DeveloperName, LastModifiedDate, ProcessType, Status, TriggerType,
							Description, VersionNumber, NamespacePrefix
						 FROM Flow
						 WHERE ProcessType = 'Workflow'
						 AND Status = 'Active'
						 AND (TableEnumOrId = '${sObjectName}' OR TableEnumOrId = null)
						 ORDER BY LastModifiedDate DESC`;
	const processes = await runCliCommand(`sf data query -t -q "${processQuery}" -o ${getOrgDescription().alias} --json`);

	//3. Obtenim els Flows
	const recordTriggerType = {
		insert: '(\'Create\', \'CreateAndUpdate\')',
		update: '(\'Update\', \'CreateAndUpdate\')',
		upsert: '(\'Create\', \'Update\', \'CreateAndUpdate\')',
		delete: '(\'Delete\')'
	}[operation];

	const flowQuery = `SELECT Id, ApiName, Label, TriggerType, TriggerOrder, TriggerObjectOrEventLabel, TriggerObjectOrEventId, RecordTriggerType, Description
							FROM FlowDefinitionView
							WHERE IsActive = TRUE AND ProcessType = 'AutoLaunchedFlow' AND NamespacePrefix = NULL AND
							AND TriggerObjectOrEventId.QualifiedApiName = '${sObjectName}'
							AND TriggerType IN ('RecordBeforeSave', 'RecordAfterSave', 'RecordBeforeDelete')
							AND RecordTriggerType IN ${recordTriggerType}`;
	const flows = await runCliCommand(`sf data query -t -q "${flowQuery}" -o ${getOrgDescription().alias} --json`);

	//4. Obtenim les Validation Rules
	const validationRulesQuery = `SELECT Id, Active, ErrorDisplayField, ErrorMessage, Description,
									EntityDefinition.QualifiedApiName, ValidationName
							 FROM ValidationRule
							 WHERE Active = true
							 AND EntityDefinition.QualifiedApiName = '${sObjectName}'`;
	const validationRules = await runCliCommand(`sf data query -t -q "${validationRulesQuery}" -o ${getOrgDescription().alias} --json`);

	//5. Obtenim els Workflow Rules
	const workflowRulesQuery = `SELECT Id, Name, TableEnumOrId, Active, Description, TriggerType
								FROM WorkflowRule
								WHERE Active = true
								AND TableEnumOrId = '${sObjectName}'`;
	const workflowRules = await runCliCommand(`sf data query -t -q "${workflowRulesQuery}" -o ${getOrgDescription().alias} --json`);

	//Analitzem el codi dels triggers per detectar dependències
	const triggerAnalysis = triggers.result.records.map(trigger => {
		const body = trigger.Body;
		const dependencies = {
			flows: [],
			processes: [],
			apex: []
		};

		//Busquem crides a Flow.Interview
		const flowMatches = body.match(/Flow\.Interview\.[A-Za-z0-9_]+/g) || [];
		dependencies.flows = [...new Set(flowMatches.map(m => m.split('.')[2]))];

		//Busquem crides a classes Apex
		const apexMatches = body.match(/[A-Za-z0-9_]+\.[A-Za-z0-9_]+/g) || [];
		dependencies.apex = [...new Set(apexMatches.map(m => m.split('.')[0]))];

		return {
			name: trigger.Name,
			dependencies
		};
	});

	//Ordenem els components segons l'ordre d'execució de Salesforce
	const executionOrder = [];

	//1. System Validation Rules
	executionOrder.push({
		step: 1,
		name: 'System Validation Rules',
		description: 'Validacions del sistema (required fields, lookup filters, etc.)'
	});

	//2. Before Triggers
	const beforeTriggers = triggers.result.records.filter(t => t.Body.includes('before'));
	if (beforeTriggers.length > 0) {
		executionOrder.push({
			step: 2,
			name: 'Before Triggers',
			components: beforeTriggers.map(t => {
				const analysis = triggerAnalysis.find(ta => ta.name === t.Name);
				return {
					name: t.Name,
					dependencies: analysis ? analysis.dependencies : null
				};
			})
		});
	}

	//3. Custom Validation Rules
	if (validationRules.result.records.length > 0) {
		executionOrder.push({
			step: 3,
			name: 'Custom Validation Rules',
			components: validationRules.result.records.map(vr => ({
				name: vr.ValidationName,
				description: vr.Description,
				errorMessage: vr.ErrorMessage,
				errorField: vr.ErrorDisplayField
			}))
		});
	}

	//4. Before Save Flow
	const beforeSaveFlows = flows.result.records.filter(f =>
		f.TriggerType === 'RecordBeforeSave');
	if (beforeSaveFlows.length > 0) {
		executionOrder.push({
			step: 4,
			name: 'Before Save Flows',
			components: beforeSaveFlows.map(f => ({
				name: f.DeveloperName,
				description: f.Description,
				version: f.VersionNumber,
				lastModifiedBy: f.LastModifiedBy ? f.LastModifiedBy.Name : null,
				lastModifiedDate: f.LastModifiedDate
			}))
		});
	}

	//5. Assignment Rules, Auto-Response Rules, Escalation Rules
	executionOrder.push({
		step: 5,
		name: 'Assignment/Auto-Response/Escalation Rules',
		description: 'Si estan configurades per l\'SObject'
	});

	//6. Duplicate Rules
	executionOrder.push({
		step: 6,
		name: 'Duplicate Rules',
		description: 'Si estan configurades per l\'SObject'
	});

	//7. Save Record
	executionOrder.push({
		step: 7,
		name: 'Save Record to Database',
		description: 'Salesforce guarda el registre a la base de dades'
	});

	//8. After Save Flow
	const afterSaveFlows = flows.result.records.filter(f =>
		f.TriggerType === 'RecordAfterSave');
	if (afterSaveFlows.length > 0) {
		executionOrder.push({
			step: 8,
			name: 'After Save Flows',
			components: afterSaveFlows.map(f => ({
				name: f.DeveloperName,
				description: f.Description,
				version: f.VersionNumber,
				lastModifiedBy: f.LastModifiedBy ? f.LastModifiedBy.Name : null,
				lastModifiedDate: f.LastModifiedDate
			}))
		});
	}

	//9. After Triggers
	const afterTriggers = triggers.result.records.filter(t => t.Body.includes('after'));
	if (afterTriggers.length > 0) {
		executionOrder.push({
			step: 9,
			name: 'After Triggers',
			components: afterTriggers.map(t => {
				const analysis = triggerAnalysis.find(ta => ta.name === t.Name);
				return {
					name: t.Name,
					dependencies: analysis ? analysis.dependencies : null
				};
			})
		});
	}

	//10. Process Builder
	if (processes.result.records.length > 0) {
		executionOrder.push({
			step: 10,
			name: 'Process Builder',
			components: processes.result.records.map(p => ({
				name: p.DeveloperName,
				description: p.Description,
				version: p.VersionNumber,
				triggerType: p.TriggerType,
				namespace: p.NamespacePrefix
			}))
		});
	}

	//11. Workflow Rules
	if (workflowRules.result.records.length > 0) {
		executionOrder.push({
			step: 11,
			name: 'Workflow Rules',
			components: workflowRules.result.records.map(w => ({
				name: w.Name,
				description: w.Description,
				triggerType: w.TriggerType
			}))
		});
	}

	//12. Roll-Up Summary Fields
	executionOrder.push({
		step: 12,
		name: 'Roll-Up Summary Fields',
		description: 'Actualització de camps Roll-Up Summary'
	});

	//13. Sharing Rules
	executionOrder.push({
		step: 13,
		name: 'Sharing Rule Evaluation',
		description: 'Avaluació de regles de sharing'
	});

	//14. Commit
	executionOrder.push({
		step: 14,
		name: 'Commit',
		description: 'Commit de la transacció'
	});

	//15. Post-Commit Logic
	executionOrder.push({
		step: 15,
		name: 'Post-Commit Logic',
		description: 'Lògica post-commit (emails, outbound messages, etc.)'
	});

	return {
		sObjectName,
		operation,
		executionOrder,
		summary: {
			triggers: triggers.result.records.length,
			validationRules: validationRules.result.records.length,
			flows: flows.result.records.length,
			processes: processes.result.records.length,
			workflowRules: workflowRules.result.records.length
		}
	};
}

export {triggerExecutionOrder};