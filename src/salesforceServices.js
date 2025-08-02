import { log } from './utils.js';
import { config } from './config.js';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(execCallback);
import fs from 'fs/promises';
import path from 'path';
import state from './state.js';
import os from 'os';

//Helper function to generate timestamp in YYMMDDHHMMSS format
function generateTimestamp() {
	const now = new Date();
	const year = String(now.getFullYear()).slice(-2); //Get last 2 digits of year
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');

	return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

//Helper function to convert username to camelCase
function toCamelCase(username) {
	return username
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, '') //Remove special characters
		.split(/\s+/)
		.map((word, index) => {
			if (index === 0) {
				return word; //First word stays lowercase
			}
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join('');
}

//Helper function to generate filename with username and timestamp
function generateApexFileName(username = 'unknown') {
	const timestamp = generateTimestamp();
	const camelCaseUsername = toCamelCase(username);
	return `apexRun_${camelCaseUsername}${timestamp}`;
}

export async function runCliCommand(command) {
	try {
		log(`Running SF CLI command: ${command}`, 'debug');
		log(`Running SF CLI command - Workspace path: ${config.workspacePath}`, 'debug');
		const { stdout } = await execPromise(command, { maxBuffer: 100 * 1024 * 1024, cwd: config.workspacePath });
		log(`SF CLI command output: ${stdout}`, 'debug');

		return stdout;

	} catch (error) {
		log(`Error running SF CLI command: ${error.message}`, 'error');
		throw error;
	}
}

export async function executeSoqlQuery(query, useToolingApi = false) {
	try {
		if (!query || typeof query !== 'string') {
			throw new Error('La consulta SOQL (query) és obligatòria i ha de ser una string');
		}

		const command = `sf data query --query "${query}" ${useToolingApi ? '--use-tooling-api' : ''} --json`;
		log(`Executing SOQL query command: ${command}`, 'debug');
		const response = await JSON.parse(await runCliCommand(command));
		if (response.status !== 0) {
			throw new Error(response.message || 'Error executant la consulta SOQL');
		}
		return response.result;

	} catch (error) {
		log(`Error executing SOQL query: ${error.message}`, 'error');
		throw error;
	}
}

export async function getOrgAndUserDetails() {
	try {
		const orgResult = JSON.parse(await runCliCommand('sf org display user --json'))?.result;
		if (!orgResult?.id || orgResult.id === 'unknown') {
			throw new Error('Error: Could not retrieve Salesforce org and user details.');
		}
		const soqlUserResult = await executeSoqlQuery(`SELECT Name FROM User WHERE Id = '${orgResult.id}'`);
		const userFullName = soqlUserResult?.records?.[0]?.Name;
		const { id, username, profileName, ...orgResultWithoutUserFields } = orgResult;
		const org = { ...orgResultWithoutUserFields, user: { id, username, profileName, name: userFullName } };

		if (!org?.user?.id) {
			throw new Error('Error: No se pudo obtener la información del usuario de Salesforce');
		}

		log(`Org and user details successfully retrieved: \n${JSON.stringify(org, null, 3)}`, 'debug');
		return org;

	} catch (error) {
		log(`Error getting org and user details: ${error.message}`, 'error');
		throw error;
	}
}

export async function createRecord(sObjectName, fields, useToolingApi = false) {
	try {
		if (!sObjectName || !fields || typeof fields !== 'object') {
			throw new Error('sObjectName i fields són obligatoris');
		}

		const valuesString = Object.entries(fields)
			.map(([key, value]) => `${key}='${String(value).replace(/'/g, '\\\'')}'`)
			.join(' ');
		const command = `sf data create record --sobject ${sObjectName} --values "${valuesString}" ${useToolingApi ? '--use-tooling-api' : ''} --json`;
		log(`Executing create record command: ${command}`, 'debug');
		const response = await JSON.parse(await runCliCommand(command));
		if (response.status !== 0) {
			throw new Error(response.message || 'Error creant el registre');
		}
		return response.result;

	} catch (error) {
		log(`Error creating record in object ${sObjectName}: ${JSON.stringify(error, null, 3)}`, 'error');
		throw error;
	}
}

export async function updateRecord(sObjectName, recordId, fields, useToolingApi = false) {
	try {
		if (!sObjectName || !recordId || !fields || typeof fields !== 'object') {
			throw new Error('sObjectName, recordId i fields són obligatoris');
		}
		const valuesString = Object.entries(fields)
			.map(([key, value]) => `${key}='${String(value).replace(/'/g, '\\\'')}'`)
			.join(' ');
		const command = `sf data update record --sobject ${sObjectName} --record-id ${recordId} --values "${valuesString}" ${useToolingApi ? '--use-tooling-api' : ''} --json`;
		log(`Executing update record command: ${command}`, 'debug');
		const response = await JSON.parse(await runCliCommand(command));
		if (response.status !== 0) {
			throw new Error(response.message || 'Error actualitzant el registre');
		}
		return response.result;

	} catch (error) {
		log(`Error updating record ${recordId} in object ${sObjectName}: ${JSON.stringify(error, null, 3)}`, 'error');
		throw error;
	}
}

export async function deleteRecord(sObjectName, recordId, useToolingApi = false) {
	try {
		if (!sObjectName || !recordId) {
			throw new Error('sObjectName i recordId són obligatoris');
		}

		const command = `sf data delete record --sobject ${sObjectName} --record-id ${recordId} ${useToolingApi ? '--use-tooling-api' : ''} --json`;
		log(`Executing delete record command: ${command}`, 'debug');
		const response = await JSON.parse(await runCliCommand(command));
		if (response.status !== 0) {
			throw new Error(response.message || 'Error eliminant el registre');
		}
		return response.result;

	} catch (error) {
		log(`Error deleting record ${recordId} from object ${sObjectName}: ${JSON.stringify(error, null, 3)}`, 'error');
		throw error;
	}
}

export async function getRecord(sObjectName, recordId) {
	try {
		if (!sObjectName || !recordId) {
			throw new Error('sObjectName i recordId són obligatoris');
		}
		const command = `sf data get record --sobject ${sObjectName} --record-id ${recordId} --json`;
		log(`Executing get record command: ${command}`, 'debug');
		const response = await JSON.parse(await runCliCommand(command));
		if (response.status !== 0) {
			throw new Error(response.message || 'Error obtenint el registre');
		}
		return response.result;

	} catch (error) {
		log(`Error getting record ${recordId} from object ${sObjectName}: ${error.message}`, 'error');
		throw error;
	}
}

export async function describeObject(sObjectName) {
	try {
		if (!sObjectName || typeof sObjectName !== 'string') {
			throw new Error('sObjectName és obligatori i ha de ser una string');
		}
		const command = `sf sobject describe --sobject ${sObjectName} --json`;
		log(`Executing describe object command: ${command}`, 'debug');
		const response = await JSON.parse(await runCliCommand(command));
		return response;

	} catch (error) {
		log(`Error describing object ${sObjectName}: ${error.message}`, 'error');
		throw error;
	}
}

export async function runApexTest(classNames = [], methodNames = [], codeCoverage = false, synchronous = false) {
	try {
		let command = 'sf apex run test';

		for (const className of classNames) {
			command += ` --class-names ${className}`;
		}

		for (const methodName of methodNames) {
			command += ` --tests ${methodName}`;
		}
		if (codeCoverage) {
			command += ' --code-coverage';
		}
		if (synchronous) {
			command += ' --synchronous';
		}
		command += ' --test-level RunSpecifiedTests --json';

		const response = await runCliCommand(command);
		const responseObj = JSON.parse(response);

		if (responseObj.status !== 0) {
			throw new Error(responseObj.message || 'Error executant el test d\'Apex');
		}

		return responseObj.result.testRunId;

	} catch (error) {
		log('Error running Apex tests:', 'error');
		log(error, 'error');

		throw error;
	}
}

export async function executeAnonymousApex(apexCode) {
	if (!apexCode || typeof apexCode !== 'string') {
		throw new Error('apexCode és obligatori i ha de ser una string');
	}
	const tmpDir = os.tmpdir() || path.join(process.cwd(), 'tmp');

	let tmpFile;
	let tmpOutFile;
	try {
		//Assegura que la carpeta tmp existeix
		await fs.mkdir(tmpDir, { recursive: true });

		//Get username from state or use 'unknown' as fallback
		const username = state.org?.user?.name || 'unknown';

		const baseFileName = generateApexFileName(username);
		tmpFile = path.join(tmpDir, `${baseFileName}.apex`);
		tmpOutFile = path.join(tmpDir, `${baseFileName}.log`);
		log(`ÑÑÑÑTmp out file: ${tmpOutFile}`, 'debug');

		//Escriu el codi Apex al fitxer temporal
		await fs.writeFile(tmpFile, apexCode, 'utf8');
		const command = `sf apex run --file "${tmpFile}" --json > "${tmpOutFile}"`;
		log(`Executing anonymous Apex: ${command}`, 'debug');
		let cliError = null;
		try {
			await runCliCommand(command); //Ja no cal capturar la sortida aquí
		} catch (cliErr) {
			cliError = cliErr;
		}

		let output = null;
		let response = null;
		let outputReadError = null;

		try {
			output = await fs.readFile(tmpOutFile, 'utf8');
			response = JSON.parse(output);

		} catch (readErr) {
			outputReadError = readErr;
		}

		let errorMsg = '';
		if (cliError || outputReadError || !response || response.status !== 0) {
			if (cliError) {
				errorMsg += `${cliError.message || cliError}`;
				if (cliError.stderr) {
					errorMsg += `\nCLI stderr: ${cliError.stderr}`;
				}
			}
			if (outputReadError) {
				errorMsg += `Error reading output file: ${outputReadError.message}`;
			}
			if (output) {
				errorMsg += `Output file content: ${output}`;
			}
			if (response && response.message) {
				errorMsg += `Salesforce error: ${response.message}`;
			}
			log(errorMsg, 'error');
			throw new Error(errorMsg);
		}
		log(response, 'debug');
		return response.result;

	} catch (error) {
		log(`Error executing anonymous Apex: ${JSON.stringify(error, null, 3)}`, 'error');
		throw error;

	} finally {
		//Elimina els fitxers temporals (comentat per mantenir els fitxers)
		/*
		if (tmpFile) {
			try {
				await fs.unlink(tmpFile);
			} catch (e) {
				//No passa res si no es pot eliminar
			}
		}
		if (tmpOutFile) {
			try {
				await fs.unlink(tmpOutFile);
			} catch (e) {
				//No passa res si no es pot eliminar
			}
		}
		*/
	}
}

export async function deployMetadata(sourceDir) {
	try {
		const command = `sf project deploy start --source-dir "${sourceDir}" --ignore-conflicts --json`;

		// Determine the working directory based on the sourceDir path
		// If sourceDir is an absolute path, use its parent directory
		let workingDir = config.workspacePath;
		if (path.isAbsolute(sourceDir)) {
			workingDir = path.dirname(sourceDir);
		}

		// Execute command and capture both stdout and stderr
		log(`Running SF CLI command: ${command}`, 'debug');
		log(`Running SF CLI command - Working directory: ${workingDir}`, 'debug');

		let stdout, stderr;
		try {
			const result = await execPromise(command, {
				maxBuffer: 100 * 1024 * 1024,
				cwd: workingDir
			});
			stdout = result.stdout;
			stderr = result.stderr;
		} catch (error) {
			// Even if the process fails, try to capture stdout if available
			stdout = error.stdout || '';
			stderr = error.stderr || '';
			log(`CLI command failed but captured output: ${stdout}`, 'debug');
			if (stderr) {
				log(`CLI command stderr: ${stderr}`, 'debug');
			}
		}

		log(`SF CLI command output: ${stdout}`, 'debug');
		if (stderr) {
			log(`SF CLI command stderr: ${stderr}`, 'debug');
		}

		// Try to parse the response
		let response;
		try {
			response = JSON.parse(stdout);
		} catch (parseError) {
			throw new Error(`Failed to parse CLI response: ${parseError.message}\nOutput: ${stdout}\nStderr: ${stderr || 'None'}`);
		}

		if (response.status !== 0 || (response.exitCode ?? 0) !== 0) {
			// Extract specific error details from the CLI response
			let errorMessage = 'Deployment failed';

			if (response.result) {
				const result = response.result;

				// Check for component failures
				if (result.details && result.details.componentFailures) {
					const failures = result.details.componentFailures;
					errorMessage += `:\n\n`;

					failures.forEach((failure, index) => {
						errorMessage += `${index + 1}. Component: ${failure.fullName || failure.fileName || 'Unknown'}\n`;
						errorMessage += `   Type: ${failure.componentType || 'Unknown'}\n`;
						errorMessage += `   Problem: ${failure.problem || 'Unknown error'}\n`;
						errorMessage += `   Problem Type: ${failure.problemType || 'Unknown'}\n\n`;
					});
				}

				// Check for files with errors
				if (result.files) {
					const failedFiles = result.files.filter(file => file.state === 'Failed');
					if (failedFiles.length > 0) {
						errorMessage += `Files with errors:\n`;
						failedFiles.forEach((file, index) => {
							errorMessage += `${index + 1}. File: ${file.fullName || 'Unknown'}\n`;
							errorMessage += `   Type: ${file.type || 'Unknown'}\n`;
							errorMessage += `   Error: ${file.error || 'Unknown error'}\n\n`;
						});
					}
				}

				// Add deployment status info
				if (result.status) {
					errorMessage += `Deployment Status: ${result.status}\n`;
				}
				if (result.numberComponentErrors !== undefined) {
					errorMessage += `Component Errors: ${result.numberComponentErrors}\n`;
				}
				if (result.numberComponentsDeployed !== undefined) {
					errorMessage += `Components Deployed: ${result.numberComponentsDeployed}\n`;
				}
			} else {
				// Fallback to original error if no structured result
				errorMessage += `: ${response.message || 'Unknown error'}`;
			}

			throw new Error(errorMessage);
		}
		return response;

	} catch (error) {
		log(`Error deploying metadata file ${sourceDir}: ${error}`, 'error');
		throw error;
	}
}

export async function callSalesforceApi(operation, apiPath, body = null, baseUrl = null) {
	if (!baseUrl) {
		//For relative paths, construct the full URL using org instance URL
		await getOrgAndUserDetails();
		const orgDesc = state.org;
		if (!orgDesc || !orgDesc.instanceUrl) {
			throw new Error('Org description not initialized. Please wait for server initialization.');
		}
		baseUrl = orgDesc.instanceUrl;
	}

	const endpoint = `${baseUrl}${apiPath}`;

	try {
		log(`Making Salesforce API call: ${operation} ${endpoint}`);

		//Use curl through CLI for API calls
		let command = `curl -X ${operation} -H "Authorization: Bearer ${state.currentAccessToken}" -H "Content-Type: application/json"`;

		if (body && (operation === 'POST' || operation === 'PATCH' || operation === 'PUT')) {
			command += ` -d '${JSON.stringify(body, null, 3)}'`;
		}

		command += ` "${endpoint}"`;

		const result = await runCliCommand(command);

		//Try to parse JSON response
		try {
			return JSON.parse(result);
		} catch (parseError) {
			log(`Warning: Could not parse JSON response: ${parseError.message}`);
			return result; //Return raw response if JSON parsing fails
		}
	} catch (error) {
		log(`Error calling Salesforce API: ${error.message}`);
		throw error;
	}
}