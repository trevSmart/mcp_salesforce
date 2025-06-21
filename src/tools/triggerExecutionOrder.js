import {salesforceState} from '../state.js';
import {runCliCommand} from '../utils.js';

/**
 * Returns the execution order of automation components for an SObject and operation
 * @param {Object} arguments Tool arguments
 * @param {string} arguments.sObjectName SObject name
 * @param {string} arguments.operation DML operation (insert, update or delete)
 * @returns {Promise<Object>} Execution result
 */
async function triggerExecutionOrder(args) {
	const sObjectName = args.sObjectName;
	const operation = args.operation.toLowerCase();

	if (!['insert', 'update', 'delete'].includes(operation.toLowerCase())) {
		throw new Error('Operation must be one of: insert, update, delete');
	}

	//1. Get triggers
	const operationFilter = operation === 'insert' ? 'before insert, after insert' : operation === 'update' ? 'before update, after update' : 'before delete, after delete';
	const triggersQuery = `SELECT Name, NamespacePrefix FROM ApexTrigger WHERE TableEnumOrId = '${sObjectName}' AND (Status = 'Active') AND (NamespacePrefix = '' OR NamespacePrefix = NULL) ORDER BY Name`;
	log(`Executing query: ${triggersQuery}`);
	const triggers = await runCliCommand(`sf data query -t -q "${triggersQuery}" -o "${salesforceState.orgDescription.alias}" --json`);

	//2. Get Process Builders
	const processQuery = `SELECT Id, DeveloperName, LastModifiedDate, ProcessType, Status, TriggerType,
							Description, VersionNumber, NamespacePrefix
							FROM Flow
							WHERE ProcessType = 'Workflow'
							AND Status = 'Active'
							AND (TableEnumOrId = '${sObjectName}' OR TableEnumOrId = null)
							ORDER BY LastModifiedDate DESC`;
	log(`Executing query: ${processQuery}`);
	const processes = await runCliCommand(`sf data query -t -q "${processQuery}" -o "${salesforceState.orgDescription.alias}" --json`);
	log('Processes: ', processes);

	//3. Get Flows
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
							AND RecordTriggerType IN ${recordTriggerType}
							AND IsTemplate = FALSE`;
	log(`Executing query: ${flowQuery}`);
	const flows = await runCliCommand(`sf data query -t -q "${flowQuery}" -o "${salesforceState.orgDescription.alias}" --json`);

	//4. Get Validation Rules
	const validationRulesQuery = `SELECT Id, Active, ErrorDisplayField, ErrorMessage, Description,
									EntityDefinition.QualifiedApiName, ValidationName
							 FROM ValidationRule
							 WHERE Active = true
							 AND EntityDefinition.QualifiedApiName = '${sObjectName}'`;
	log(`Executing query: ${validationRulesQuery}`);
	const validationRules = await runCliCommand(`sf data query -t -q "${validationRulesQuery}" -o "${salesforceState.orgDescription.alias}" --json`);

	//5. Get Workflow Rules
	const workflowRulesQuery = `SELECT Id, Name, TableEnumOrId, Active, Description, TriggerType
								FROM WorkflowRule
								WHERE Active = true
								AND TableEnumOrId = '${sObjectName}'`;
	log(`Executing query: ${workflowRulesQuery}`);
	const workflowRules = await runCliCommand(`sf data query -t -q "${workflowRulesQuery}" -o "${salesforceState.orgDescription.alias}" --json`);

	//Analyze the trigger code to detect dependencies
	const triggerAnalysis = triggers.result.records.map(trigger => {
		const body = trigger.Body;
		const dependencies = {
			flows: [],
			processes: [],
			apex: []
		};

		//Find calls to Flow.Interview
		const flowMatches = body.match(/Flow\.Interview\.[A-Za-z0-9_]+/g) || [];
		dependencies.flows = [...new Set(flowMatches.map(m => m.split('.')[2]))];

		//Find calls to Apex classes
		const apexMatches = body.match(/[A-Za-z0-9_]+\.[A-Za-z0-9_]+/g) || [];
		dependencies.apex = [...new Set(apexMatches.map(m => m.split('.')[0]))];

		return {
			name: trigger.Name,
			dependencies
		};
	});

	//Order the components according to Salesforce execution order
	const executionOrder = [];

	//1. System Validation Rules
	executionOrder.push({
		step: 1,
		name: 'System Validation Rules',
		description: 'System validations (required fields, lookup filters, etc.)'
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
		description: 'If configured for the SObject'
	});

	//6. Duplicate Rules
	executionOrder.push({
		step: 6,
		name: 'Duplicate Rules',
		description: 'If configured for the SObject'
	});

	//7. Save Record
	executionOrder.push({
		step: 7,
		name: 'Save Record to Database',
		description: 'Salesforce saves the record to the database'
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
		description: 'Roll-Up Summary Fields update'
	});

	//13. Sharing Rules
	executionOrder.push({
		step: 13,
		name: 'Sharing Rule Evaluation',
		description: 'Sharing rules evaluation'
	});

	//14. Commit
	executionOrder.push({
		step: 14,
		name: 'Commit',
		description: 'Transaction commit'
	});

	//15. Post-Commit Logic
	executionOrder.push({
		step: 15,
		name: 'Post-Commit Logic',
		description: 'Post-commit logic (emails, outbound messages, etc.)'
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

export default triggerExecutionOrder;