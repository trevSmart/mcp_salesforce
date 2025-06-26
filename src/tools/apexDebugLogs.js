import {salesforceState} from '../state.js';
import executeSoqlQuery from './soqlQuery.js';
import createRecord from './createRecord.js';
import updateRecord from './updateRecord.js';
import {runCliCommand, log} from '../utils.js';
import { logIdSchema, messageSchema } from './paramSchemas.js';
import { z } from 'zod';

const actionSchema = z.enum(['status','on','off','list','get']);

async function apexDebugLogs(params) {
	const schema = z.object({
		action: actionSchema,
		logId: logIdSchema.optional(),
		message: messageSchema.optional(),
	});
	const parseResult = schema.safeParse(params);
	if (!parseResult.success) {
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error de validació: ${parseResult.error.message}`
			}]
		};
	}

	try {
		const userDescription = salesforceState.userDescription;
		let traceFlag;

		if (params.action === 'status') {
			log('Checking existing TraceFlag...');

			traceFlag = await executeSoqlQuery({
				query: `SELECT Id FROM TraceFlag WHERE TracedEntityId = '${userDescription.id}' AND StartDate < ${new Date().toISOString()} AND ExpirationDate > ${new Date().toISOString()} LIMIT 1`,
				useToolingApi: true
			})?.[0];

			return {
				content: [{
					type: 'text',
					text: `Debug logs for user ${userDescription.username} status: ${traceFlag ? 'active' : 'inactive'}`
				}],
				structuredContent: {status: traceFlag ? 'active' : 'inactive', traceFlag}
			};

		} else if (params.action === 'on') {
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
					],
					structuredContent: traceFlag
				};
			}

		} else if (params.action === 'off') {
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
					],
					structuredContent: null
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
				],
				structuredContent: {status: 'deactivated', traceFlag}
			};

		} else if (params.action === 'list') {
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

		} else if (params.action === 'get') {
			const apexLog = await runCliCommand(`sf apex:log:get --log-id ${params.logId} --include-body`);

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