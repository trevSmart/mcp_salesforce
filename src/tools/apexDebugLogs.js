import {salesforceState} from '../state.js';
import executeSoqlQuery from './soqlQuery.js';
import createRecord from './createRecord.js';
import updateRecord from './updateRecord.js';
import {runCliCommand, log} from '../utils.js';

async function apexDebugLogs({action, logId}) {

	try {
		const userDescription = salesforceState.userDescription;
		let traceFlag;

		if (action === 'status') {
			log('Checking existing TraceFlag...');

			traceFlag = await executeSoqlQuery({
				query: `SELECT Id FROM TraceFlag WHERE TracedEntityId = '${userDescription.id}' AND StartDate < ${new Date().toISOString()} AND ExpirationDate > ${new Date().toISOString()} LIMIT 1`,
				useToolingApi: true
			})?.[0];

			return {
				content: [{
					type: 'text',
					text: `Debug logs for user ${userDescription.username} status: ${traceFlag ? 'active' : 'inactive'}`
				}]
			};

		} else if (action === 'on') {
			log('Checking existing TraceFlag...');

			traceFlag = await executeSoqlQuery({
				query: `SELECT DebugLevelId FROM TraceFlag WHERE TracedEntityId = '${userDescription.id}'`,
				useToolingApi: true
			})?.[0];

			const now = new Date();
			const expirationDate = new Date(now.getTime() + 45 * 60000);

			if (traceFlag) {
				log('TraceFlag found. Updating expiration date...');

				await updateRecord({sObjectName: 'TraceFlag', recordId: traceFlag.Id, fields: {
					StartDate: now.toISOString(),
					ExpirationDate: expirationDate.toISOString()
				}});
			} else {
				log('No existing TraceFlag found. Creating new DebugLevel and TraceFlag...');
				const debugLogLevel = await createRecord({sObjectName: 'DebugLevel', fields: {
					DeveloperName: `UserDebug_${Date.now()}`,
					MasterLabel: `Debug Log Level ${userDescription.username}`,
					ApexCode: 'FINEST',
					//ApexProfiling: 'FINEST',
					//Callout: 'FINEST',
					//Database: 'FINEST',
					//System: 'FINEST',
					//Validation: 'FINEST',
					Visualforce: 'FINER'
				}});

				traceFlag = await createRecord({sObjectName: 'TraceFlag', fields: {
					TracedEntityId: userDescription.id,
					DebugLevelId: debugLogLevel.Id,
					LogType: 'DEVELOPER_LOG',
					StartDate: now.toISOString(),
					ExpirationDate: expirationDate.toISOString()
				}});

				return {
					content: [
						{
							type: 'text',
							text: `Debug logs activated for ${userDescription.username} with ID ${traceFlag.Id}`
						}
					]
				};
			}

		} else if (action === 'off') {
			traceFlag = await executeSoqlQuery({
				query: `SELECT DebugLevelId FROM TraceFlag WHERE TracedEntityId = '${userDescription.id}' AND ExpirationDate > ${new Date().toISOString()}`,
				useToolingApi: true
			})?.[0];

			if (!traceFlag) {
				return {
					content: [
						{
							type: 'text',
							text: 'No active debug logs found'
						}
					]
				};
			}

			await updateRecord({sObjectName: 'TraceFlag', recordId: traceFlag.Id, fields: {
				ExpirationDate: new Date().toISOString()
			}});

			return {
				content: [
					{
						type: 'text',
						text: `Debug logs deactivated for ${userDescription.username}`
					}
				]
			};

		} else if (action === 'list') {
			const logs = await runCliCommand('sf apex:log:list --include-body');

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(logs, null, '\t')
					}
				]
			};

		} else if (action === 'get') {
			const apexLog = await runCliCommand(`sf apex:log:get --log-id ${logId} --include-body`);

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(apexLog, null, '\t')
					}
				]
			};
		}

	} catch (error) {
		log('Complete error:', error);
		return {
			isError: true,
			content: [
				{
					type: 'text',
					text: `❌ Error managing debug logs: ${error.message}`
				}
			]
		};
	}
}

export default apexDebugLogs;