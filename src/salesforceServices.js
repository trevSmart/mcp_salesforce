import { log, getSfCliCurrentTargetOrg } from './utils.js';
import { config } from './config.js';
import { exec as execCb } from 'child_process';
import { promisify } from 'node:util';
import fs from 'fs/promises';
import path from 'path';
import state from './state.js';
import os from 'os';
import { resources } from './mcp-server.js';
const exec = promisify(execCb);

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

		let stdout = null;
		try {
			const response = await exec(command, {
				maxBuffer: 100 * 1024 * 1024, cwd: config.workspacePath, windowsHide: true
			});
			stdout = response.stdout;
		} catch (error) {
			if (error.stdout) {
				stdout = error.stdout;
			} else {
				throw error;
			}
		}

		log(stdout, 'debug', 'SF CLI command output (stdout)');
		return stdout;

	} catch (error) {
		error.stderr && (error.message += `\nSTDERR: ${error.stderr}`);
		error.stdout && (error.message += `\nSTDOUT: ${error.stdout}`);
		log(error, 'error', 'Error running SF CLI command');
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
		const responseString = await runCliCommand(command);

		let response;
		try {
			response = JSON.parse(responseString);
		} catch (error) {
			throw new Error(`Error parsing JSON response: ${responseString}`);
		}

		if (response.status !== 0) {
			throw new Error(response.message || 'Error executant la consulta SOQL');
		}
		return response.result;

	} catch (error) {
		log(error, 'error', 'Error executing SOQL query');
		throw error;
	}
}

export async function getOrgAndUserDetails() {
	try {
		// Check current SF CLI target alias and reuse cached org if unchanged
		const fileAlias = getSfCliCurrentTargetOrg();
		if (fileAlias === state?.org?.alias) {
			log(`Target org alias unchanged (${fileAlias}), using cached state.org`, 'debug');
			return state.org;
		}

		const orgResultString = await runCliCommand('sf org display user --json');
		let orgResult;
		try {
			orgResult = JSON.parse(orgResultString).result;
		} catch (error) {
			throw new Error(`Error parsing JSON response: ${orgResultString}`);
		}

		if (!orgResult?.id || orgResult.id === 'unknown') {
			throw new Error('Error: Could not retrieve Salesforce org and user details.');
		}

		const org = {
			id: orgResult.orgId,
			alias: orgResult.alias,
			instanceUrl: orgResult.instanceUrl,
			user: {
				id: orgResult.id,
				username: orgResult.username,
				profileName: orgResult.profileName,
				name: null
			}
		};
		log( 'Org and user details successfully retrieved', 'debug');
		state.org = org;


		const getUserFullName = async () => {
			const soqlUserResult = await executeSoqlQuery(`SELECT Name FROM User WHERE Id = '${org.user.id}'`);
			state.org.user.name = soqlUserResult?.records?.[0]?.Name;
			resources['mcp://mcp/orgAndUserDetail.json'].text = JSON.stringify(state.org, null, 3);
		};
		getUserFullName();

		return org;

	} catch (error) {
		log(error, 'error', 'Error getting org and user details');
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

		const responseString = await runCliCommand(command);
		let response;
		try {
			response = JSON.parse(responseString);
		} catch (error) {
			throw new Error(`Error parsing JSON response: ${responseString}`);
		}

		if (response.status !== 0) {
			throw new Error(response.message || 'Error creant el registre');
		}
		return response.result;

	} catch (error) {
		log(error, 'error', `Error creating record in object ${sObjectName}`);
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

		const responseString = await runCliCommand(command);
		let response;
		try {
			response = JSON.parse(responseString);
		} catch (error) {
			throw new Error(`Error parsing JSON response: ${responseString}`);
		}

		if (response.status !== 0) {
			throw new Error(response.message || 'Error actualitzant el registre');
		}
		return response.result;

	} catch (error) {
		log(error, 'error', `Error updating record ${recordId} in object ${sObjectName}`);
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

		const responseString = await runCliCommand(command);
		let response;
		try {
			response = JSON.parse(responseString);
		} catch (error) {
			throw new Error(`Error parsing JSON response: ${responseString}`);
		}

		if (response.status !== 0) {
			throw new Error(response.message || 'Error eliminant el registre');
		}
		return response.result;

	} catch (error) {
		log(error, 'error', `Error deleting record ${recordId} from object ${sObjectName}`);
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

		const responseString = await runCliCommand(command);
		let response;
		try {
			response = JSON.parse(responseString);
		} catch (error) {
			throw new Error(`Error parsing JSON response: ${responseString}`);
		}

		if (response.status !== 0) {
			throw new Error(response.message || 'Error obtenint el registre');
		}
		return response.result;

	} catch (error) {
		log(error, 'error', `Error getting record ${recordId} from object ${sObjectName}`);
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

		const responseString = await runCliCommand(command);
		let response;
		try {
			response = JSON.parse(responseString);
		} catch (error) {
			throw new Error(`Error parsing JSON response: ${responseString}`);
		}

		return response;

	} catch (error) {
		log(error, 'error', `Error describing object ${sObjectName}`);
		throw error;
	}
}

export async function runApexTest(classNames = [], methodNames = [], codeCoverage = false, synchronous = false) {
	try {
		let command = 'sf apex run test';

		for (const className of classNames) {
			command += ` --class-names "${className}"`;
		}

		for (const methodName of methodNames) {
			command += ` --tests "${methodName}"`;
		}
		if (codeCoverage) {
			command += ' --code-coverage';
		}
		if (synchronous) {
			command += ' --synchronous';
		}
		command += ' --test-level RunSpecifiedTests --json';

		const responseString = await runCliCommand(command);
		let responseObj;
		try {
			responseObj = JSON.parse(responseString);
		} catch (error) {
			throw new Error(`Error parsing JSON response: ${responseString}`);
		}

		if (responseObj.status !== 0) {
			throw new Error(responseObj.message || 'Error executant el test d\'Apex');
		}

		return responseObj.result.testRunId;

	} catch (error) {
		log(error, 'error', 'Error running Apex tests');
		throw error;
	}
}

export async function executeAnonymousApex(apexCode) {
	if (!apexCode || typeof apexCode !== 'string') {
		throw new Error('apexCode és obligatori i ha de ser una string');
	}
	const tmpDir = os.tmpdir() || path.join(process.cwd(), 'tmp');

	let tmpFile;
	try {
		//Assegura que la carpeta tmp existeix
		await fs.mkdir(tmpDir, { recursive: true });

		//Get username from state or use 'unknown' as fallback
		const username = state.org?.user?.name || 'unknown';

		const baseFileName = generateApexFileName(username);
		tmpFile = path.join(tmpDir, `${baseFileName}.apex`);

		//Escriu el codi Apex al fitxer temporal
		await fs.writeFile(tmpFile, apexCode, 'utf8');
		const command = `sf apex run --file "${tmpFile}" --json`;
		log(`Executing anonymous Apex: ${command}`, 'debug');
		let cliError = null;
		let output = null;
		let response = null;

		try {
			output = await runCliCommand(command);
			try {
				response = JSON.parse(output);
			} catch (parseError) {
				throw new Error(`Error parsing JSON response: ${output}`);
			}
		} catch (cliErr) {
			cliError = cliErr;
		}

		let errorMsg = '';
		if (cliError || !response || response.status !== 0) {
			if (cliError) {
				errorMsg += `${cliError.message || cliError}`;
				if (cliError.stderr) {
					errorMsg += `\nCLI stderr: ${cliError.stderr}`;
				}
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
		log(error, 'error', 'Error executing anonymous Apex');
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
		*/
	}
}

export async function deployMetadata(sourceDir) {
	try {
		const command = `sf project deploy start --source-dir "${sourceDir}" --ignore-conflicts --json`;
		log(`Executing deploy metadata command: ${command}`, 'debug');

		const responseString = await runCliCommand(command);
		let response;
		try {
			response = JSON.parse(responseString);
		} catch (error) {
			throw new Error(`Error parsing CLI response: ${responseString}`);
		}

		return response.result;

	} catch (error) {
		log(error, 'error', `Error deploying metadata file ${sourceDir}`);
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
		log(error, 'error', 'Error calling Salesforce API');
		throw error;
	}
}