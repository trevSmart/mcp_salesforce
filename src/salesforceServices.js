import {log} from './utils.js';
import fs from 'fs/promises';
import path from 'path';
import state from './state.js';
import {newResource} from './mcp-server.js';
import {exec as execCb} from 'child_process';
import {promisify} from 'node:util';
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
		let stdout = null;
		try {
			const response = await exec(command, {
				maxBuffer: 100 * 1024 * 1024, cwd: state.workspacePath, windowsHide: true
			});
			stdout = response.stdout;
		} catch (error) {
			if (error.stdout) {
				stdout = error.stdout;
			} else {
				throw error;
			}
		}
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

		const apiType = useToolingApi ? 'TOOLING' : 'REST';
		const response = await callSalesforceApi('GET', apiType, '/query', null, {queryParams: {q: query}});

		// Validate response structure
		if (!response || typeof response !== 'object') {
			throw new Error('Invalid response structure from Salesforce API');
		}

		// Check for Salesforce API errors
		if (response.errors?.length) {
			throw new Error(`Salesforce API error: ${response.errors.map(err => err.message || err).join('; ')}`);
		}

		// Return the response (contains records, totalSize, done, etc.)
		return response;

	} catch (error) {
		log(error, 'error', 'Error executing SOQL query');
		throw error;
	}
}

export async function getOrgAndUserDetails(skipCache = false) {
	try {
		if (state?.org?.alias && !skipCache) {
			log('Org and user details already cached, skipping fetch', 'debug');
			return state.org;
		}

		const orgResultString = await runCliCommand('sf org display --json');
		let orgResult;
		try {
			orgResult = JSON.parse(orgResultString).result;
		} catch {
			throw new Error(`Error parsing JSON response: ${orgResultString}`);
		}

		if (!orgResult?.username || orgResult.username === 'unknown') {
			throw new Error('Error: Could not retrieve Salesforce org and user details.');
		}

		const org = {
			id: orgResult.id,
			alias: orgResult.alias,
			instanceUrl: orgResult.instanceUrl,
			apiVersion: orgResult.apiVersion,
			accessToken: orgResult.accessToken,
			user: {
				id: null,
				username: orgResult.username,
				profileName: null,
				name: null
			}
		};
		state.org = org;

		const getUserFullName = async () => {
			const soqlUserResult = await executeSoqlQuery(`SELECT Id, Name, Profile.Name FROM User WHERE Username = '${org.user.username}'`);
			const user = soqlUserResult?.records?.[0];
			state.org.user = {
				id: user.Id,
				username: orgResult.username,
				profileName: user.Profile?.Name,
				name: user.Name
			};
			newResource(
				'mcp://org/orgAndUserDetail.json',
				'Org and user details',
				'Org and user details',
				'application/json',
				JSON.stringify(state.org, null, 3)
			);
		};
		getUserFullName();

		return org;

	} catch (error) {
		log(error, 'error', 'Error getting org and user details');
		throw error;
	}
}

// NEW UNIFIED VERSION - Supports both UI API and Tooling API
export async function dmlOperation(operations, options = {}) {
	try {
		// Validate org state
		if (!state?.org?.instanceUrl || !state?.org?.accessToken) {
			throw new Error('Org details not initialized. Please wait for server initialization.');
		}

		// Validate that at least one operation type is provided
		const hasOperations = operations.create?.length || operations.update?.length || operations.delete?.length;
		if (!hasOperations) {
			throw new Error('At least one operation must be specified (create, update, delete)');
		}

		// Determine which API to use based on options
		const useToolingApi = options.useToolingApi === true;

		if (useToolingApi) {
			const compositeRequests = [];

			if (operations.create?.length) {
				operations.create.forEach((record, index) => {
					compositeRequests.push({
						method: 'POST',
						url: `/services/data/v${state.org.apiVersion}/tooling/sobjects/${record.sObjectName}`,
						referenceId: `create_${index}`,
						body: record.fields
					});
				});
			}

			if (operations.update?.length) {
				operations.update.forEach((record, index) => {
					compositeRequests.push({
						method: 'PATCH',
						url: `/services/data/v${state.org.apiVersion}/tooling/sobjects/${record.sObjectName}/${record.recordId}`,
						referenceId: `update_${index}`,
						body: record.fields
					});
				});
			}

			if (operations.delete?.length) {
				operations.delete.forEach((record, index) => {
					compositeRequests.push({
						method: 'DELETE',
						url: `/services/data/v${state.org.apiVersion}/tooling/sobjects/${record.sObjectName}/${record.recordId}`,
						referenceId: `delete_${index}`
					});
				});
			}

			const payload = {
				allOrNone: options.allOrNone || false,
				compositeRequest: compositeRequests
			};
			const result = await callSalesforceApi('POST', 'TOOLING', '/composite', payload);

			if (!result || typeof result !== 'object') {
				log(result, 'error', 'Invalid response structure from Salesforce Tooling API');
				throw new Error('Invalid response structure from Salesforce Tooling API');
			}

			const successes = [];
			const errors = [];

			if (Array.isArray(result.compositeResponse)) {
				result.compositeResponse.forEach((subResponse, index) => {
					if (subResponse.httpStatusCode >= 200 && subResponse.httpStatusCode < 300) {
						successes.push({
							index,
							id: subResponse.body?.id
						});
					} else {
						let message = 'Unknown error';
						let type;
						let fields;

						if (Array.isArray(subResponse.body) && subResponse.body.length > 0) {
							const err = subResponse.body[0];
							message = err.message || message;
							type = err.errorCode;
							fields = err.fields;
						} else if (subResponse.body && typeof subResponse.body === 'object') {
							message = subResponse.body.message || JSON.stringify(subResponse.body);
							type = subResponse.body.errorCode;
							fields = subResponse.body.fields;
						}

						errors.push({index, message, type, fields});
					}
				});
			}

			if (Array.isArray(result.errors)) {
				result.errors.forEach((err, idx) => {
					errors.push({index: idx, message: err.message || String(err)});
				});
			}

			const total = successes.length + errors.length;
			const outcome = errors.length === 0 ? 'success' : successes.length === 0 ? 'error' : 'partial';

			return {
				outcome,
				statistics: {total, succeeded: successes.length, failed: errors.length},
				successes: successes.length ? successes : undefined,
				errors: errors.length ? errors : undefined
			};

		} else {
			const requestOperations = [];

			if (operations.create?.length) {
				requestOperations.push({
					type: 'Create',
					records: operations.create.map(record => ({
						apiName: record.sObjectName,
						fields: record.fields
					}))
				});
			}

			if (operations.update?.length) {
				requestOperations.push({
					type: 'Update',
					records: operations.update.map(record => ({
						fields: {
							Id: record.recordId,
							...record.fields
						}
					}))
				});
			}

			if (operations.delete?.length) {
				requestOperations.push({
					type: 'Delete',
					records: operations.delete.map(record => ({
						fields: {Id: record.recordId}
					}))
				});
			}

			const payload = {
				allOrNone: options.allOrNone || false,
				operations: requestOperations
			};

			const result = await callSalesforceApi('POST', 'UI', '/records/batch', payload);

			if (!result || typeof result !== 'object') {
				throw new Error('Invalid response structure from Salesforce API');
			}

			const successes = [];
			const errors = [];

			if (Array.isArray(result.results)) {
				result.results.forEach((operationResult, index) => {
					const statusCode = operationResult.statusCode;
					const isSuccess = statusCode >= 200 && statusCode < 300;

					if (isSuccess) {
						successes.push({
							index,
							id: operationResult.result?.id
						});
					} else {
						let message = 'Unknown error';
						let fields;
						if (operationResult.result?.errors) {
							message = operationResult.result.errors.join('; ');
							fields = operationResult.result.fields;
						} else if (operationResult.errors) {
							message = operationResult.errors.join('; ');
						}
						errors.push({index, message, fields});
					}
				});
			}

			if (Array.isArray(result.errors)) {
				result.errors.forEach((err, idx) => {
					errors.push({index: idx, message: err.message || String(err)});
				});
			}

			const total = successes.length + errors.length;
			const outcome = errors.length === 0 ? 'success' : successes.length === 0 ? 'error' : 'partial';

			return {
				outcome,
				statistics: {total, succeeded: successes.length, failed: errors.length},
				successes: successes.length ? successes : undefined,
				errors: errors.length ? errors : undefined
			};
		}

	} catch (error) {
		log(error, 'error', 'Error executing batch DML operation');
		throw error;
	}
}

export async function getRecord(sObjectName, recordId) {
	try {
		if (!sObjectName || !recordId) {
			throw new Error('sObjectName and recordId are required');
		}
		log(`Getting record via REST API: ${sObjectName}/${recordId}`, 'debug');
		const response = await callSalesforceApi('GET', 'REST', `/sobjects/${sObjectName}/${recordId}`);
		if (!response || typeof response !== 'object') {
			throw new Error('Invalid response structure from Salesforce API');
		}
		if (response.errors?.length) {
			const errorMessages = response.errors.map(err => err.message || err).join('; ');
			throw new Error(`Salesforce API error: ${errorMessages}`);
		}

		return response;

	} catch (error) {
		log(error, 'error', `Error getting record ${recordId} from object ${sObjectName}`);
		throw error;
	}
}

export async function describeObject(sObjectName) {
	try {
		if (!sObjectName || typeof sObjectName !== 'string') {
			throw new Error('sObjectName is required and must be a string');
		}
		const command = `sf sobject describe --sobject ${sObjectName} --json`;
		log(`Executing describe object command: ${command}`, 'debug');

		const responseString = await runCliCommand(command);
		let response;
		try {
			response = JSON.parse(responseString);
		} catch {
			throw new Error(`Error parsing JSON response: ${responseString}`);
		}

		return response;

	} catch (error) {
		log(error, 'error', `Error describing object ${sObjectName}`);
		throw error;
	}
}

export async function runApexTest(classNames = [], methodNames = [], suiteNames = [], codeCoverage = false, synchronous = false) {
	try {
		let command = 'sf apex run test';
		for (const className of classNames) {
			command += ` --class-names "${className}"`;
		}
		for (const methodName of methodNames) {
			command += ` --tests "${methodName}"`;
		}
		for (const suiteName of suiteNames) {
			command += ` --suite-names "${suiteName}"`;
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
		} catch {
			throw new Error(`Error parsing JSON response: ${responseString}`);
		}

		if (responseObj.status !== 0) {
			throw new Error(responseObj.message || 'Error running Apex tests');
		}

		return responseObj.result.testRunId;

	} catch (error) {
		log(error, 'error', 'Error running Apex tests');
		throw error;
	}
}

export async function getApexClassCodeCoverage(classNames = []) {
	try {
		// Backward compatibility: accept a single string too
		const requestedNames = Array.isArray(classNames) ? classNames : [classNames];
		const filteredNames = requestedNames.filter(n => typeof n === 'string' && n.trim().length);
		if (!filteredNames.length) {
			return {success: true, classes: []};
		}

		// Escape single quotes in names for SOQL
		const escapedNames = filteredNames.map(n => `'${String(n).replace(/'/g, '\\\'')}'`).join(',');

		// Ensure all requested classes exist in the org (use Tooling API ApexClass)
		const soqlExistingClasses = `SELECT Id, Name FROM ApexClass WHERE Name IN (${escapedNames})`;
		const existingClassesResult = await executeSoqlQuery(soqlExistingClasses, true);
		const existingRecords = existingClassesResult?.records || [];
		const existingNamesSet = new Set(existingRecords.map(r => r.Name));
		const existingIdByName = {};
		for (const rec of existingRecords) {
			existingIdByName[rec.Name] = rec.Id;
		}

		// Identify missing classes but don't throw error - we'll handle them gracefully
		const missingNames = filteredNames.filter(n => !existingNamesSet.has(n));
		const existingNames = filteredNames.filter(n => existingNamesSet.has(n));

		// Build initial class entries for all requested names and collect ids that have aggregate
		const classIdsForMethodQuery = [];
		const classesById = {};
		const classes = [];

		// Process existing classes first
		for (const name of existingNames) {
			const classId = existingIdByName[name];
			classes.push({
				className: name,
				classId: classId,
				numLinesCovered: 0,
				numLinesUncovered: 0,
				percentage: 0,
				coveredLines: 0,
				uncoveredLines: 0,
				totalLines: 0,
				coverageStatus: 'none',
				aggregateFound: false,
				testMethods: []
			});
		}

		// Process missing classes with appropriate status
		for (const name of missingNames) {
			classes.push({
				className: name,
				classId: null,
				numLinesCovered: 0,
				numLinesUncovered: 0,
				percentage: 0,
				coveredLines: 0,
				uncoveredLines: 0,
				totalLines: 0,
				coverageStatus: 'class not found',
				aggregateFound: false,
				testMethods: []
			});
		}

		// Only proceed with coverage queries if we have existing classes
		if (existingNames.length > 0) {
			// Include relationship Name explicitly in the SELECT
			const soqlCoverageAggregates = `SELECT ApexClassOrTriggerId, ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate WHERE ApexClassOrTrigger.Name IN (${existingNames.map(n => `'${n.replace(/'/g, '\\\'')}'`).join(',')})`;
			const responseCoverageAggregates = await executeSoqlQuery(soqlCoverageAggregates, true);
			const coverageAggregates = responseCoverageAggregates?.records || [];
			const aggregateByName = {};
			for (const agg of coverageAggregates) {
				const name = agg?.ApexClassOrTrigger?.Name;
				if (name) { aggregateByName[name] = agg; }
			}

			// Update existing classes with coverage data
			for (const entry of classes) {
				if (entry.coverageStatus !== 'class not found') {
					const agg = aggregateByName[entry.className];
					if (agg) {
						const covered = agg.NumLinesCovered || 0;
						const uncovered = agg.NumLinesUncovered || 0;
						const total = covered + uncovered;
						const percentage = total > 0 ? Math.round((covered / total) * 100) : 0;
						const coverageStatus = total === 0 ? 'none' : (percentage === 100 ? 'full' : 'partial');

						entry.numLinesCovered = covered;
						entry.numLinesUncovered = uncovered;
						entry.percentage = percentage;
						entry.coveredLines = covered;
						entry.uncoveredLines = uncovered;
						entry.totalLines = total;
						entry.coverageStatus = coverageStatus;
						entry.aggregateFound = true;

						if (agg.ApexClassOrTriggerId) {
							classesById[agg.ApexClassOrTriggerId] = entry;
							classIdsForMethodQuery.push(`'${agg.ApexClassOrTriggerId}'`);
						}
					}
				}
			}

			// Fetch method-level coverages in one query
			if (classIdsForMethodQuery.length) {
				const soqlCoverages = `SELECT ApexClassOrTriggerId, ApexTestClass.Name, TestMethodName, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverage WHERE ApexClassOrTriggerId IN (${classIdsForMethodQuery.join(',')})`;
				const responseCoverages = await executeSoqlQuery(soqlCoverages, true);
				const coverages = responseCoverages?.records || [];
				for (const cov of coverages) {
					const entry = classesById[cov.ApexClassOrTriggerId];
					if (!entry) { continue; }
					const covCovered = cov.NumLinesCovered || 0;
					const covUncovered = cov.NumLinesUncovered || 0;
					const covTotal = covCovered + covUncovered;
					entry.testMethods.push({
						testClassName: cov?.ApexTestClass?.Name,
						testMethodName: cov.TestMethodName,
						numLinesCovered: covCovered,
						numLinesUncovered: covUncovered,
						linesCovered: covCovered,
						linesUncovered: covUncovered,
						totalLines: covTotal,
						percentage: covTotal > 0 ? Math.round((covCovered / covTotal) * 100) : 0
					});
				}
				// Order and limit test methods per class
				for (const entry of classes) {
					if (entry.testMethods && entry.testMethods.length) {
						entry.testMethods.sort((a, b) => b.linesCovered - a.linesCovered);
						entry.testMethods = entry.testMethods.slice(0, 10);
					}
				}
			}
		}

		// Compute summary and sort classes (worst coverage first, then missing classes)
		classes.sort((a, b) => {
			// Missing classes go to the end
			if (a.coverageStatus === 'class not found' && b.coverageStatus !== 'class not found') { return 1; }
			if (b.coverageStatus === 'class not found' && a.coverageStatus !== 'class not found') { return -1; }
			// For existing classes, sort by coverage percentage
			return a.percentage - b.percentage;
		});

		const totalClasses = classes.length;
		const classesWithCoverage = classes.filter(c => c.aggregateFound && c.totalLines > 0).length;
		const classesWithoutCoverage = classes.filter(c => c.coverageStatus !== 'class not found' && (!c.aggregateFound || c.totalLines === 0)).length;
		const missingClasses = classes.filter(c => c.coverageStatus === 'class not found').length;
		const averagePercentage = classes.filter(c => c.coverageStatus !== 'class not found').length > 0
			? Math.round(classes.filter(c => c.coverageStatus !== 'class not found').reduce((s, c) => s + (c.percentage || 0), 0) / classes.filter(c => c.coverageStatus !== 'class not found').length)
			: 0;

		const result = {
			success: true,
			timestamp: new Date().toISOString(),
			summary: {
				totalClasses,
				classesWithCoverage,
				classesWithoutCoverage,
				missingClasses,
				averagePercentage
			},
			classes,
			errors: missingNames.length > 0 ? [{
				message: `The following Apex classes do not exist in the org: ${missingNames.join(', ')}`,
				classNames: missingNames
			}] : [],
			warnings: []
		};

		return result;

	} catch (error) {
		log(error, 'error', `Error getting code coverage for classes ${Array.isArray(classNames) ? classNames.join(', ') : classNames}`);
		throw error;
	}
}

export async function executeAnonymousApex(apexCode) {
	if (!apexCode || typeof apexCode !== 'string') {
		throw new Error('apexCode is required and must be a string');
	}
	const tmpDir = state.tempPath;

	let tmpFile;
	try {
		//Assegura que la carpeta tmp existeix
		await fs.mkdir(tmpDir, {recursive: true});

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
			} catch {
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
			log(errorMsg, 'error', 'Error executing anonymous Apex');
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

		const responseString = await runCliCommand(command);
		log(`responseString: ${responseString}`, 'debug');
		let response;
		try {
			response = JSON.parse(responseString);
		} catch (error) {
			log(error, 'error', 'Error parsing CLI response');
			throw new Error(`Error parsing CLI response: ${responseString}`);
		}

		return response.result;

	} catch (error) {
		log(error, 'error', `Error deploying metadata file ${sourceDir}`);
		throw error;
	}
}

export async function generateMetadata({type, name, outputDir, triggerSObject, triggerEvent = []}) {
	try {
		if (!type || typeof type !== 'string') {
			throw new Error('type is required and must be a string');
		}
		if (!name || typeof name !== 'string') {
			throw new Error('name is required and must be a string');
		}

		const defaultDirs = {
			apexClass: 'force-app/main/default/classes',
			apexTestClass: 'force-app/main/default/classes',
			apexTrigger: 'force-app/main/default/triggers',
			lwc: 'force-app/main/default/lwc'
		};

		const resolvedOutputDir = outputDir || defaultDirs[type];
		let command;

		if (type === 'apexClass' || type === 'apexTestClass') {
			command = `sf apex generate class --name "${name}"`;
			if (resolvedOutputDir) { command += ` --output-dir "${resolvedOutputDir}"`; }
			// No template parameter from tool; we'll inject content later for test class

		} else if (type === 'apexTrigger') {
			if (!triggerSObject || typeof triggerSObject !== 'string') {
				throw new Error('triggerSObject is required and must be a string when type is apexTrigger');
			}
			command = `sf apex generate trigger --name "${name}" --sobject "${triggerSObject}"`;
			if (Array.isArray(triggerEvent) && triggerEvent.length) {
				command += ` --event "${triggerEvent.join(',')}"`;
			}
			if (resolvedOutputDir) {
				command += ` --output-dir "${resolvedOutputDir}"`;
			}

		} else if (type === 'lwc') {
			command = `sf lightning generate component --type lwc --name "${name}"`;
			if (resolvedOutputDir) {
				command += ` --output-dir "${resolvedOutputDir}"`;
			}

		} else {
			throw new Error(`Unsupported type: ${type}`);
		}

		const stdout = await runCliCommand(command);

		const resolvedDir = path.resolve(state.workspacePath || process.cwd(), resolvedOutputDir || '.');
		let files = [];
		let folder = null;

		if (type === 'apexClass' || type === 'apexTestClass') {
			const classFilePath = path.join(resolvedDir, `${name}.cls`);
			const metaFilePath = path.join(resolvedDir, `${name}.cls-meta.xml`);
			try { await fs.access(classFilePath); files.push(classFilePath); } catch { /* File not accessible */ }
			try { await fs.access(metaFilePath); files.push(metaFilePath); } catch { /* File not accessible */ }

			// Overwrite content for Apex test classes with a fixed template
			if (type === 'apexTestClass') {
				const testClassContent = `@isTest
public class ${name} {

	@isTest
	private static void test1() {
		System.runAs(TestDataFactory.createTestUser()) {
			//Set up prerequisites for the logic under test
			TestDataFactory.createAccount('ACME Test');

			Test.startTest();
			//Invoke the logic under test
			Test.stopTest();

			//Verify expected outcome
			System.assertEquals(expectedValue, actualValue, 'Explanation of the assertion failure');
		}
	}
}`;
				try {
					await fs.writeFile(classFilePath, testClassContent, 'utf8');
				} catch {
					log(`Error writing file ${classFilePath}`, 'error');
				}
			}

		} else if (type === 'apexTrigger') {
			const triggerFilePath = path.join(resolvedDir, `${name}.trigger`);
			const metaFilePath = path.join(resolvedDir, `${name}.trigger-meta.xml`);
			try { await fs.access(triggerFilePath); files.push(triggerFilePath); } catch {
				log(`File not accessible: ${triggerFilePath}`, 'error');
			}
			try { await fs.access(metaFilePath); files.push(metaFilePath); } catch {
				log(`File not accessible: ${metaFilePath}`, 'error');
			}

		} else if (type === 'lwc') {
			folder = path.join(resolvedDir, name);
			try {
				const entries = await fs.readdir(folder);
				files = entries.map(f => path.join(folder, f));
			} catch {
				log(`Error reading directory ${folder}`, 'error');
			}
		}

		return {success: true, type, name, triggerSObject, outputDir: resolvedDir, folder, files, stdout};

	} catch (error) {
		log(error, 'error', `Error generating metadata ${name} of type ${type}`);
		throw error;
	}
}

/**
 * Refreshes the access token by running any CLI command to trigger token refresh
 * and then updates the state with the new token
 */
async function refreshAccessToken() {
	try {
		log('Access token expired, refreshing...', 'debug');
		const userDetails = await runCliCommand('sf org display user --json');
		const newAccessToken = userDetails.result.accessToken;
		state.org.accessToken = newAccessToken;
		return true;

	} catch (error) {
		log(`Failed to refresh access token: ${error.message}`, 'error');
		return false;
	}
}

export async function callSalesforceApi(operation, apiType, service, body = null, options = {}) {
	// Validate required parameters
	if (!operation || !apiType || !service) {
		throw new Error('operation, apiType, and service are required parameters');
	}

	// Validate operation
	const validOperations = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
	if (!validOperations.includes(operation.toUpperCase())) {
		throw new Error(`Invalid operation: ${operation}. Must be one of: ${validOperations.join(', ')}`);
	}

	// Validate API type
	const validApiTypes = ['REST', 'TOOLING', 'UI'];
	if (!validApiTypes.includes(apiType.toUpperCase())) {
		throw new Error(`Invalid API type: ${apiType}. Must be one of: ${validApiTypes.join(', ')}`);
	}

	// Ensure org details are available
	if (!state?.org?.instanceUrl || !state?.org?.accessToken) {
		throw new Error('Org details not initialized. Please wait for server initialization.');
	}

	// Build the full endpoint based on API type
	const apiVersion = state.org.apiVersion;
	let endpoint;

	// Check if a custom base URL is provided
	if (options.baseUrl) {
		endpoint = `${options.baseUrl}${service}`;
	} else {
		// Use org instance URL for Salesforce APIs
		switch (apiType.toUpperCase()) {
			case 'REST':
				endpoint = `${state.org.instanceUrl}/services/data/v${apiVersion}${service}`;
				break;
			case 'TOOLING':
				endpoint = `${state.org.instanceUrl}/services/data/v${apiVersion}/tooling${service}`;
				break;
			case 'UI':
				endpoint = `${state.org.instanceUrl}/services/data/v${apiVersion}/ui-api${service}`;
				break;
			default:
				throw new Error(`Unsupported API type: ${apiType}`);
		}
	}

	// Handle query parameters if provided
	if (options.queryParams && typeof options.queryParams === 'object') {
		const queryString = new URLSearchParams(options.queryParams).toString();
		if (queryString) {
			endpoint += `?${queryString}`;
		}
	}

	// Function to make the actual API call
	const makeApiCall = async () => {
		const requestOptions = {
			method: operation.toUpperCase(),
			headers: {
				'Authorization': `Bearer ${state.org.accessToken}`,
				'Content-Type': 'application/json'
			}
		};

		// Add custom headers if provided
		if (options.headers && typeof options.headers === 'object') {
			Object.assign(requestOptions.headers, options.headers);
		}

		if (body && (operation.toUpperCase() === 'POST' || operation.toUpperCase() === 'PATCH' || operation.toUpperCase() === 'PUT')) {
			requestOptions.body = JSON.stringify(body);
		}

		const response = await fetch(endpoint, requestOptions);

		let logMessage = `${operation} request to ${apiType} API service ${service} ended ${response.statusText} (${response.status})`;
		if (Object.keys(options.queryParams || {}).length) {
			logMessage += `\n${JSON.stringify(options.queryParams, null, 3)}`;
		}
		if (Object.keys(requestOptions).length) {
			logMessage += `\n${JSON.stringify(requestOptions, null, 3)}`;
		}
		log(logMessage, 'debug');

		if (!response.ok) {
			let errorDetails = '';
			try {
				const errorBody = await response.text();
				errorDetails = `Status: ${response.status} ${response.statusText}\nResponse body: ${errorBody}`;

				// Check if this is an INVALID_SESSION_ID error
				if (errorBody.includes('INVALID_SESSION_ID')) {
					throw new Error('INVALID_SESSION_ID');
				}

			} catch (parseError) {
				if (parseError.message === 'INVALID_SESSION_ID') {
					throw parseError;
				}
				errorDetails = `Status: ${response.status} ${response.statusText}\nCould not parse response body: ${parseError.message}`;
			}

			throw new Error(`Salesforce API call failed: ${operation} ${endpoint}\n${errorDetails}`);
		}

		try {
			return (await response.json());

		} catch (parseError) {
			log(`Could not parse JSON response: ${parseError.message}`, 'warning');
			return (await response.text());
		}
	};

	// Try to make the API call, with automatic token refresh if needed
	// Maximum retry attempts to prevent infinite loops
	const maxRetries = 2; // Allow 1 token refresh + 1 retry
	let retryCount = 0;

	while (retryCount <= maxRetries) {
		try {
			return await makeApiCall();
		} catch (error) {
			// Check if this is an INVALID_SESSION_ID error
			if (error.message === 'INVALID_SESSION_ID' && retryCount < maxRetries) {
				retryCount++;
				const refreshSuccess = await refreshAccessToken();

				if (refreshSuccess) {
					// Continue to next iteration to retry with new token
					log('Token refreshed successfully, retrying API call...', 'debug');
					continue;
				} else {
					throw new Error('Failed to refresh access token. Please re-authenticate with Salesforce CLI.');
				}
			}

			// If we've exhausted retries or it's not an INVALID_SESSION_ID error, throw the error
			if (retryCount >= maxRetries && error.message === 'INVALID_SESSION_ID') {
				throw new Error(`Maximum retry attempts (${maxRetries}) exceeded for INVALID_SESSION_ID. Please re-authenticate with Salesforce CLI.`);
			}

			// Re-throw other errors
			log(error, 'error', `Error calling Salesforce API: ${operation} ${endpoint}`);
			throw error;
		}
	}
}