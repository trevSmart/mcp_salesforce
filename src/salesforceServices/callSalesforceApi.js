import state from '../state.js';
import {runCliCommand} from './runCliCommand.js';
import {log} from '../utils.js';
import {getOrgAndUserDetails} from './getOrgAndUserDetails.js';

/**
 * Makes direct API calls to Salesforce using the CLI and curl
 * @param {string} method - HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @param {string} baseUrl - Base URL for the API call (optional, uses org instance URL if not provided)
 * @param {string} apiPath - API path/endpoint
 * @param {Object} body - Request body for POST/PUT/PATCH requests (optional)
 * @returns {Promise<Object>} - API response
 */
export async function callSalesforceApi(method, baseUrl = null, apiPath = '', body = null) {
	if (!baseUrl) {
		//For relative paths, construct the full URL using org instance URL
		await getOrgAndUserDetails();
		const orgDesc = state.orgDescription;
		if (!orgDesc || !orgDesc.instanceUrl) {
			throw new Error('Org description not initialized. Please wait for server initialization.');
		}
		baseUrl = orgDesc.instanceUrl;
	}

	const endpoint = `${baseUrl}${apiPath}`;

	try {
		log(`Making Salesforce API call: ${method} ${endpoint}`);

		//Use curl through CLI for API calls
		let command = `curl -X ${method} -H "Authorization: Bearer ${state.currentAccessToken}" -H "Content-Type: application/json"`;

		if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
			command += ` -d '${JSON.stringify(body)}'`;
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

/**
 * Makes a GET request to Salesforce API
 * @param {string} apiPath - API path/endpoint
 * @param {string} baseUrl - Base URL (optional)
 * @returns {Promise<Object>} - API response
 */
export async function getSalesforceApi(apiPath, baseUrl = null) {
	return callSalesforceApi('GET', baseUrl, apiPath);
}

/**
 * Makes a POST request to Salesforce API
 * @param {string} apiPath - API path/endpoint
 * @param {Object} body - Request body
 * @param {string} baseUrl - Base URL (optional)
 * @returns {Promise<Object>} - API response
 */
export async function postSalesforceApi(apiPath, body, baseUrl = null) {
	return callSalesforceApi('POST', baseUrl, apiPath, body);
}

/**
 * Makes a PUT request to Salesforce API
 * @param {string} apiPath - API path/endpoint
 * @param {Object} body - Request body
 * @param {string} baseUrl - Base URL (optional)
 * @returns {Promise<Object>} - API response
 */
export async function putSalesforceApi(apiPath, body, baseUrl = null) {
	return callSalesforceApi('PUT', baseUrl, apiPath, body);
}

/**
 * Makes a PATCH request to Salesforce API
 * @param {string} apiPath - API path/endpoint
 * @param {Object} body - Request body
 * @param {string} baseUrl - Base URL (optional)
 * @returns {Promise<Object>} - API response
 */
export async function patchSalesforceApi(apiPath, body, baseUrl = null) {
	return callSalesforceApi('PATCH', baseUrl, apiPath, body);
}

/**
 * Makes a DELETE request to Salesforce API
 * @param {string} apiPath - API path/endpoint
 * @param {string} baseUrl - Base URL (optional)
 * @returns {Promise<Object>} - API response
 */
export async function deleteSalesforceApi(apiPath, baseUrl = null) {
	return callSalesforceApi('DELETE', baseUrl, apiPath);
}