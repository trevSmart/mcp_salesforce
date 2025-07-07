import {runCliCommand} from './runCliCommand.js';
import {executeSoqlQuery} from './executeSoqlQuery.js';
import {log} from '../utils.js';

/**
 * Executa una classe o mètode de test d'Apex a Salesforce
 * @param {string[]} classNames - Nom de la classe de test Apex
 * @param {string[]} methodNames - Nom del mètode de test (opcional)
 * @param {boolean} [codeCoverage=false] - Si true, afegeix --code-coverage
 * @param {boolean} [synchronous=false] - Si true, afegeix --synchronous
 * @returns {Promise<Object>} - Resultat de l'execució del test
 */
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

		let testRunResult;
		while (true) {
			const testRunResults = await executeSoqlQuery(`SELECT Id, Status, StartTime, TestTime, TestSetupTime, ClassesEnqueued, ClassesCompleted, MethodsEnqueued, MethodsCompleted, MethodsFailed FROM ApexTestRunResult WHERE AsyncApexJobId = '${responseObj.result.testRunId}'`);
			testRunResult = testRunResults.records[0];
			if (!testRunResult || testRunResult.Status !== 'Processing' && testRunResult.Status !== 'Queued') {
				break;
			}
			await new Promise(resolve => setTimeout(resolve, 10000)); //Espera 10 segons
		}

		const testResults = await executeSoqlQuery(`SELECT ApexClass.Name, MethodName, Outcome, RunTime, Message, StackTrace FROM ApexTestResult WHERE ApexTestRunResultId = '${testRunResult.Id}'`);
		return testResults.records;

	} catch (error) {
		log('Error running Apex tests:', 'error');
		log(error, 'error');

		throw error;
	}
}