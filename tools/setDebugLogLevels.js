/*globals process*/
import {runCliCommand} from './utils';

async function setDebugLogLevels({userId, active}, _meta) {
	try {
		//server.sendLoggingMessage({
		//level: 'debug',
		//data: 'AlohA',
		//});

		console.error('');
		console.error('Checking existing TraceFlag...');
		const traceFlag = runCliCommand(
			`sf data:query --query "SELECT Id, LogType, StartDate, ExpirationDate, DebugLevelId, DebugLevel.ApexCode, DebugLevel.Visualforce FROM TraceFlag WHERE LogType='DEVELOPER_LOG' AND TracedEntityId='${userId}'" -o ${process.env.username} --use-tooling-api --json`
		).result.records?.[0]

		if (!traceFlag) {
			console.error('');
			console.error('No existing TraceFlag found. Creating new DebugLevel and TraceFlag...');
			const debugLevelResult = runCliCommand(
				`sf data:create:record --sobject DebugLevel --values "DeveloperName=API_Trace_${timestamp()} MasterLabel=API_Trace ApexCode=FINEST Visualforce=FINER" -o ${process.env.username} --use-tooling-api --json`
			);
			const debugLevelData = debugLevelResult;

			if (!debugLevelData.status || debugLevelData.status !== '0') {
				throw new Error('Failed to create DebugLevel' + debugLevelData);
			}

			debugLevelId = debugLevelData.result.id;

			//Creem el TraceFlag
			const startDate = new Date();
			const expirationDate = new Date(startDate.getTime() + 30 * 60000);

			try {
				const traceFlagResult = runCliCommand(
					`sf data:create:record --sobject TraceFlag --values "TracedEntityId='${userId}' DebugLevelId='${debugLevelId}' LogType='DEVELOPER_LOG' StartDate='${startDate.toISOString()}' ExpirationDate='${expirationDate.toISOString()}'" -o ${process.env.username} --use-tooling-api --json`
				);
				const traceFlagData = traceFlagResult;

				if (!traceFlagData.status || traceFlagData.status !== '0') {
					throw new Error('Failed to create TraceFlag' + traceFlagData);
				}

				traceFlag = {
					Id: traceFlagData.result.id,
					DebugLevelId: debugLevelId
				};
			} catch (error) {
				throw new Error(`Error creating TraceFlag: ${error.message}`);
			}
		}

		if (!active) {
			//If we want to disable logs, force immediate expiration of TraceFlag
			const now = new Date();
			try {
				const updateTraceFlagResult = runCliCommand(
					`sf data:update:record --sobject TraceFlag --record-id ${traceFlag.Id} --values "ExpirationDate=${now.toISOString()}" -o ${process.env.username} --use-tooling-api --json`
				);
				const traceFlagUpdateData = updateTraceFlagResult;

				if (!traceFlagUpdateData.status || traceFlagUpdateData.status !== '0') {
					throw new Error('Error updating TraceFlag expiration date. ' + traceFlagUpdateData);
				}

				return {
					content: [
						{
							type: 'text',
							text: '✅ Debug logs successfully deactivated'
						}
					]
				};
			} catch (error) {
				throw new Error(`Error updating TraceFlag expiration: ${error.message}`);
			}
		}

		console.error('');
		console.error(`Updating DebugLevel ${traceFlag.DebugLevelId}...`);

		const logLevels = active ? 'ApexCode=FINEST Visualforce=FINER' : 'DB=INFO ApexCode=DEBUG Visualforce=NONE Database=NONE System=INFO Workflow=INFO Validation=INFO Callouts=INFO Profiling=NONE Wave=NONE Nba=NONE';

		try {
			const result = runCliCommand(
				`sf data:update:record --sobject DebugLevel --record-id ${traceFlag.DebugLevelId} --values "${logLevels}" -o ${process.env.username} --use-tooling-api --json`
			);
			const traceFlagUpdateDebugLevelData = result;
			if (!traceFlagUpdateDebugLevelData.status || traceFlagUpdateDebugLevelData.status !== '0') {
				throw new Error('Error updating DebugLevel. ' + traceFlagUpdateDebugLevelData);
			}
		} catch (error) {
			throw new Error(`Error updating DebugLevel: ${error.message}`);
		}

		//Update TraceFlag expiration date if logs are active
		if (active) {
			const now = new Date();
			const expirationDate = new Date(now.getTime() + 30 * 60000); //30 minuts en milisegons

			try {
				const updateTraceFlagResult = runCliCommand(
					`sf data:update:record --sobject TraceFlag --record-id ${traceFlag.Id} --values "StartDate=${now.toISOString()}" "ExpirationDate=${expirationDate.toISOString()}" -o ${process.env.username} --use-tooling-api --json`
				);
				const traceFlagUpdateData = updateTraceFlagResult;

				if (!traceFlagUpdateData.status || traceFlagUpdateData.status !== '0') {
					throw new Error('Error updating TraceFlag expiration date. ' + traceFlagUpdateData);
				}
			} catch (error) {
				throw new Error(`Error updating TraceFlag expiration: ${error.message}`);
			}
		}

		return {
			content: [
				{
					type: 'text',
					text: active ?
						'✅ Log levels successfully updated for Apex Replay Debugger:\n- ApexCode: FINEST\n- Visualforce: FINER\n- Duration: 30 minutes' :
						'✅ All log levels successfully set to NONE'
				}
			]
		};
	} catch (error) {
		console.error('');
		console.error('Complete error:', error);
		return {
			isError: true,
			content: [
				{
					type: 'text',
					text: `❌ Error configuring log levels: ${error.message}`
				}
			]
		};
	}
}

function timestamp() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}${month}${day}`;
}

export {setDebugLogLevels};