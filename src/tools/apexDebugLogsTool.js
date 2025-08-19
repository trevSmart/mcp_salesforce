import { newResource } from '../mcp-server.js';
import { mcpServer } from '../mcp-server.js';
import state from '../state.js';
import client from '../client.js';
import {log, textFileContent, formatDate} from '../utils.js';
import {executeSoqlQuery, dmlOperation, runCliCommand} from '../salesforceServices.js';
import {z} from 'zod';

export const apexDebugLogsToolDefinition = {
	name: 'apexDebugLogs',
	title: 'Manage Apex debug logs',
	description: textFileContent('apexDebugLogsTool'),
	inputSchema: {
		action: z.enum(['status', 'on', 'off', 'list', 'get'])
			.describe('The action to perform. Possible values: "status", "on", "off", "list", "get".'),
		logId: z.string()
			.optional()
			.describe('The ID of the log to retrieve (optional for "get" action - if not provided, user will be prompted to select from available logs)')
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Manage Apex debug logs'
	}
};

export async function apexDebugLogsTool({action, logId}) {
	try {
		if (!['status', 'on', 'off', 'list', 'get'].includes(action)) {
			throw new Error(`Invalid action: ${action}`);
		}

		const user = state?.org?.user;
		log(`User data: ${JSON.stringify(user)}`, 'debug');
		if (!user) {
			throw new Error('User data not found');
		}
		let traceFlag;

		if (action === 'status') {
			log('Checking already existing TraceFlag...', 'debug');

			const soqlTraceFlagResult = await executeSoqlQuery(
				`SELECT Id, StartDate, ExpirationDate, DebugLevel.DeveloperName FROM TraceFlag WHERE TracedEntityId = '${user.id}' AND StartDate < ${new Date().toISOString()} AND ExpirationDate > ${new Date().toISOString()} LIMIT 1`,
				true
			);
			const traceFlag = soqlTraceFlagResult?.records?.[0];

			if (traceFlag) {
				const startDate = new Date(traceFlag.StartDate);
				const expirationDate = new Date(traceFlag.ExpirationDate);
				const now = new Date();
				const status = startDate < now && expirationDate > now ? '🟢 Active' : '🟥 Inactive';

				return {
					content: [{
						type: 'text',
						text: `Apex debug logs status for user ${user.name} in ${state?.org?.alias}: ${status}.`
					}],
					structuredContent: {
						user: user.name,
						status,
						traceFlagId: traceFlag.Id,
						startDate: formatDate(startDate),
						expirationDate: formatDate(expirationDate),
						debugLevel: traceFlag?.DebugLevel?.DeveloperName || null
					}
				};
			} else {
				return {
					content: [{
						type: 'text',
						text: `Apex debug logs status for user ${user.name} in ${state?.org?.alias}: 🟥 Inactive`
					}],
					structuredContent: {status: 'inactive', traceFlag: null}
				};
			}

		} else if (action === 'on') {
			//1. Check if there's already an active TraceFlag
			log('Checking for already active TraceFlag...', 'debug');
			const soqlActiveTraceFlagResult = await executeSoqlQuery(
				`SELECT Id, StartDate, ExpirationDate, DebugLevel.DeveloperName FROM TraceFlag WHERE TracedEntityId = '${user.id}' AND LogType = 'DEVELOPER_LOG' AND ExpirationDate > ${new Date().toISOString()}`,
				true
			);
			const activeTraceFlag = soqlActiveTraceFlagResult?.records?.[0];

			if (activeTraceFlag) {
				// Extend the expiration date by 1 hour from now
				const now = new Date();
				const newExpirationDate = new Date(now.getTime() + 60 * 60000); //1 hour from now
				await dmlOperation({
					update: [{
						sObjectName: 'TraceFlag',
						recordId: activeTraceFlag.Id,
						fields: {ExpirationDate: newExpirationDate.toISOString()}
					}],
					useToolingApi: true
				});

				const startDate = new Date(activeTraceFlag.StartDate);

				return {
					content: [{
						type: 'text',
						text: `Debug logs were already active for ${user.name} in ${state?.org?.alias}. Extended expiration date for the next hour, new expiration date is ${formatDate(newExpirationDate)}.`
					}],
					structuredContent: {
						user: user.name,
						traceFlagId: activeTraceFlag.Id,
						status: startDate < now && newExpirationDate > now ? '🟢 Active' : '🟥 Inactive',
						startDate: formatDate(startDate),
						expirationDate: formatDate(newExpirationDate),
						debugLevel: activeTraceFlag.DebugLevel?.DeveloperName || null
					}
				};
			}

			//2. Find or create DebugLevel with DeveloperName=ReplayDebuggerLevels
			let soqlDebugLevelResult = await executeSoqlQuery("SELECT Id FROM DebugLevel WHERE DeveloperName = 'ReplayDebuggerLevels' LIMIT 1", true);
			let debugLevelId = soqlDebugLevelResult?.records?.[0]?.Id;

			if (!debugLevelId) {
				log('DebugLevel not found. Creating new DebugLevel...', 'debug');
				const debugLevelResult = await dmlOperation({
					create: [{
						sObjectName: 'DebugLevel',
						fields: {
							DeveloperName: 'ReplayDebuggerLevels',
							MasterLabel: 'ReplayDebuggerLevels',
							ApexCode: 'FINEST',
							Visualforce: 'FINER'
						}
					}]
				}, { useToolingApi: true });
				debugLevelId = debugLevelResult.results[0].body.id;
			}

			const now = new Date();
			const startDate = new Date(now);
			const expirationDate = new Date(startDate.getTime() + 60 * 60000); //1 hour
			const traceFlagResult = await dmlOperation({
				create: [{
					sObjectName: 'TraceFlag',
					fields: {
						TracedEntityId: user.id,
						DebugLevelId: debugLevelId,
						LogType: 'DEVELOPER_LOG',
						StartDate: startDate.toISOString(),
						ExpirationDate: expirationDate.toISOString()
					}
				}]
			}, { useToolingApi: true });
			const newTraceFlag = traceFlagResult.results[0].body;

			return {
				content: [{
					type: 'text',
					text: `Apex debug logs status for ${user.name} in ${state?.org?.alias}: active`
				}],
				structuredContent: {
					traceFlagId: newTraceFlag.id,
					status: startDate <= now && now <= expirationDate ? '🟢 Active' : '🟥 Inactive',
					startDate: formatDate(startDate),
					expirationDate: formatDate(expirationDate),
					debugLevelName: 'ReplayDebuggerLevels'
				}
			};

		} else if (action === 'off') {
			const soqlTraceFlagResult = await executeSoqlQuery(
				`SELECT Id, DebugLevelId FROM TraceFlag WHERE TracedEntityId = '${user.id}' AND ExpirationDate >= ${new Date().toISOString()}`,
				true
			);
			const traceFlag = soqlTraceFlagResult?.records?.[0];

			if (!traceFlag) {
				return {
					content: [{
						type: 'text',
						text: `Debug logs were already inactive for ${user.name} in ${state?.org?.alias}, no action taken`
					}],
					structuredContent: {}
				};
			}

			const newExpirationDate = new Date(Date.now() + 10000); // 10 seconds in the future
			await dmlOperation({
				update: [{
					sObjectName: 'TraceFlag',
					recordId: traceFlag.Id,
					fields: {ExpirationDate: newExpirationDate.toISOString()}
				}],
				useToolingApi: true
			});

			return {
				content: [{
					type: 'text',
					text: `Apex debug logs status for ${user.name} in ${state?.org?.alias}: 🟥 Inactive`
				}],
				structuredContent: {...traceFlag, status: '🟥 Inactive', expirationDate: formatDate(newExpirationDate)}
			};

		} else if (action === 'list') {
			let response = await runCliCommand('sf apex list log --json');
			let logs = [];

			try {
				const parsedResponse = JSON.parse(response);
				logs = parsedResponse?.result || [];
			} catch (error) {
				log(`Error parsing JSON response: ${error.message}`, 'error');
				logs = [];
			}

			if (logs && Array.isArray(logs)) {
				// Take only the first 50 logs and format them
				logs = logs.slice(0, 50).map(log => {
					if (log.LogLength) {
						const lengthInBytes = parseInt(log.LogLength);
						if (lengthInBytes < 1024 * 1024) {
							log.LogLength = `${Math.floor(lengthInBytes / 1024)} KB`;
						} else {
							log.LogLength = `${(lengthInBytes / (1024 * 1024)).toFixed(1)} MB`;
						}
					}

					// Convert duration from DurationMilliseconds to seconds
					if (log.DurationMilliseconds) {
						const durationMs = parseInt(log.DurationMilliseconds);
						if (durationMs < 1000) {
							log.duration = `${durationMs}ms`;
						} else {
							log.duration = `${Math.floor(durationMs / 1000)}s`;
						}
						// Remove the original attribute
						delete log.DurationMilliseconds;
					}

					log.StartTime = formatDate(new Date(log.StartTime));
					return log;
				});
			} else {
				logs = [];
			}

			return {
				content: [{
					type: 'text',
					text: `${logs.length} Apex debug logs found in ${state?.org?.alias}`
				}],
				structuredContent: logs
			};

		} else if (action === 'get') {
			if (!logId) {
				if (client.supportsCapability('elicitation')) {
					// Get the list of available logs for selection
					let response = await runCliCommand('sf apex list log --json');
					let logs = [];

					try {
						const parsedResponse = JSON.parse(response);
						logs = parsedResponse?.result || [];
					} catch (error) {
						log(`Error parsing JSON response: ${error.message}`, 'error');
						logs = [];
					}

					if (!logs || !Array.isArray(logs) || logs.length === 0) {
						throw new Error('No Apex debug logs available for selection');
					}

					// Take only the first 50 logs and format them for selection
					const availableLogs = logs.slice(0, 50).map(log => {
						const startTime = formatDate(new Date(log.StartTime));
						const user = log.ExecutedBy || log.User || 'Unknown';
						const size = log.LogLength ?
							(parseInt(log.LogLength) < 1024 * 1024 ?
								`${Math.floor(parseInt(log.LogLength) / 1024)} KB` :
								`${(parseInt(log.LogLength) / (1024 * 1024)).toFixed(1)} MB`) : 'N/A';

						return {
							id: log.Id,
							description: `${startTime} · ${user} · ${size}`
						};
					});

					const elicitResult = await mcpServer.server.elicitInput({
						message: `Please select an Apex debug log to retrieve. Available logs: ${availableLogs.length}`,
						requestedSchema: {
							type: "object",
							title: `Select Apex debug log to retrieve`,
							properties: {
								logId: {
									type: "string",
									enum: availableLogs.map(log => log.id),
									enumNames: availableLogs.map(log => log.description),
									description: 'Select the Apex debug log to retrieve'
								}
							},
							required: ["logId"]
						}
					});

					if (elicitResult.action !== 'accept' || !elicitResult.content?.logId) {
						return {
							content: [{
								type: 'text',
								text: 'User has cancelled the log selection'
							}],
							structuredContent: elicitResult
						};
					}

					logId = elicitResult.content.logId;
				} else {
					throw new Error('logId is required for the "get" action');
				}
			}

			const apexLog = await runCliCommand(`sf apex get log --log-id ${logId}`);

			const content = [{
				type: 'text',
				text: `Succesfully retrieved Apex debug log ${logId}`
			}];

			if (client.supportsCapability('embeddedResources')) {
				const resource = newResource(
					`file://mcp/apexLogs/${logId}.log`,
					`${logId}.log`,
					`Apex debug log ${logId}`,
					'text/plain',
					apexLog,
					{audience: ['user']}
				);
				content.push({type: 'resource', resource});
			}

			return {
				content,
				structuredContent: apexLog
			};
		}

	} catch (error) {
		log(error, 'error');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error managing debug logs: ${error.message}`
			}]
		};
	}
}