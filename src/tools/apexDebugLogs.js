import state from '../state.js';
import {executeSoqlQuery} from '../salesforceServices/executeSoqlQuery.js';
import {createRecord} from '../salesforceServices/createRecord.js';
import {updateRecord} from '../salesforceServices/updateRecord.js';
import {log, loadToolDescription} from '../utils.js';
import {runCliCommand} from '../salesforceServices/runCliCommand.js';
import {deleteRecord} from '../salesforceServices/deleteRecord.js';

export const apexDebugLogsToolDefinition = {
	name: 'apexDebugLogs',
	title: 'Apex Debug Logs',
	description: loadToolDescription('apexDebugLogs'),
	inputSchema: {
		type: 'object',
		required: ['action'],
		properties: {
			action: {
				type: 'string',
				description: 'The action to perform. Possible values: "status", "on", "off", "list", "get".'
			}
		}
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Apex Debug Logs'
	}
};

export async function apexDebugLogsTool({action, logId}) {
	try {
		if (!['status', 'on', 'off', 'list', 'get'].includes(action)) {
			throw new Error(`Invalid action: ${action}`);
		}

		const userDescription = state.org.user;
		let traceFlag;

		if (action === 'status') {
			log('Checking existing TraceFlag...');

			traceFlag = await executeSoqlQuery(
				`SELECT Id FROM TraceFlag WHERE TracedEntityId = '${userDescription.id}' AND StartDate < ${new Date().toISOString()} AND ExpirationDate > ${new Date().toISOString()} LIMIT 1`,
				true
			)?.[0];

			return {
				content: [{
					type: 'text',
					text: `Debug logs for user ${userDescription.username} status: ${traceFlag ? 'active' : 'inactive'}`
				}],
				structuredContent: {status: traceFlag ? 'active' : 'inactive', traceFlag}
			};

		} else if (action === 'on') {
			log('Deleting expired TraceFlags for user...');
			//1. Delete expired TraceFlags for the user
			const expiredTraceFlagsResult = await executeSoqlQuery(
				`SELECT Id FROM TraceFlag WHERE TracedEntityId = '${userDescription.id}' AND ExpirationDate < ${new Date().toISOString()}`,
				true
			);
			if (expiredTraceFlagsResult?.records?.length) {
				for (const tf of expiredTraceFlagsResult.records) {
					try {
						await deleteRecord('TraceFlag', tf.Id, true);
					} catch (err) {
						log(`Error deleting expired TraceFlag ${tf.Id}: ${err.message}`, 'warning');
					}
				}
			}

			//2. Find or create DebugLevel with DeveloperName=ReplayDebuggerLevels
			log('Looking for DebugLevel with DeveloperName=ReplayDebuggerLevels...');
			let debugLevelId = null;
			const debugLevelResult = await executeSoqlQuery(
				'SELECT Id FROM DebugLevel WHERE DeveloperName = \'ReplayDebuggerLevels\' LIMIT 1',
				true
			);
			if (debugLevelResult?.records?.length && debugLevelResult.records[0].Id) {
				debugLevelId = debugLevelResult.records[0].Id;
			} else {
				log('DebugLevel not found. Creating new DebugLevel...');
				const newDebugLevel = await createRecord('DebugLevel', {
					DeveloperName: 'ReplayDebuggerLevels',
					MasterLabel: 'ReplayDebuggerLevels',
					ApexCode: 'FINEST',
					Visualforce: 'FINER'
				}, true);
				debugLevelId = newDebugLevel.id || newDebugLevel.Id;
			}

			//3. Create new TraceFlag for the user
			const now = new Date();
			const expirationDate = new Date(now.getTime() + 30 * 60000); //30 minutes
			const newTraceFlag = await createRecord('TraceFlag', {
				TracedEntityId: userDescription.id,
				DebugLevelId: debugLevelId,
				LogType: 'DEVELOPER_LOG',
				StartDate: now.toISOString(),
				ExpirationDate: expirationDate.toISOString()
			}, true);

			//4. Return activation info
			return {
				content: [{
					type: 'text',
					text: `Apex debug logging is turned on for ${userDescription.username}. It will expire at ${expirationDate.toLocaleTimeString()}. TraceFlag ID: ${newTraceFlag.id || newTraceFlag.Id}`
				}],
				structuredContent: newTraceFlag
			};

		} else if (action === 'off') {
			traceFlag = await executeSoqlQuery(
				`SELECT DebugLevelId FROM TraceFlag WHERE TracedEntityId = '${userDescription.id}' AND ExpirationDate > ${new Date().toISOString()}`,
				true
			)?.[0];

			if (!traceFlag) {
				return {
					content: [{
						type: 'text',
						text: 'No active debug logs found'
					}]
				};
			}

			await updateRecord('TraceFlag', traceFlag.Id, {ExpirationDate: new Date().toISOString()}, true);

			return {
				content: [{
					type: 'text',
					text: `Debug logs deactivated for ${userDescription.username}`
				}],
				structuredContent: {status: 'deactivated', traceFlag}
			};

		} else if (action === 'list') {
			const logs = await runCliCommand('sf apex:log:list --include-body');

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(logs, null, '\t')
					}
				],
				structuredContent: logs
			};

		} else if (action === 'get') {
			const apexLog = await runCliCommand(`sf apex:log:get --log-id ${logId} --include-body`);

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(apexLog, null, '\t')
					}
				],
				structuredContent: apexLog
			};
		}

	} catch (error) {
		log('Complete error:', error);
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error managing debug logs: ${error.message}`
			}]
		};
	}
}