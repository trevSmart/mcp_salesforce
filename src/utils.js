import fetch from 'node-fetch';
import {exec} from 'child_process';
import {promisify} from 'util';
import {salesforceState} from './state.js';
import {globalCache} from './cache.js';
import {CONFIG} from './config.js';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const execPromise = promisify(exec);

const salesforceConfig = {
	apiVersion: process.env.SF_API_VERSION || '63.0',
	loginUrl: process.env.loginUrl || 'https://test.salesforce.com',
	clientId: process.env.SF_CON,
	clientSecret: process.env.SF_MCP_CONNECTED_APP_CLIENT_SECRET,
	password: process.env.password
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function log(message, logLevel = 'info') {
	const LOG_LEVEL_PRIORITY = {info: 0, debug: 1, warn: 2, error: 3};

	if (LOG_LEVEL_PRIORITY[logLevel] < LOG_LEVEL_PRIORITY[CONFIG.currentLogLevel]) {
		return;
	}

	if (typeof message === 'object') {
		message = JSON.stringify(message, null, '\t');
	}
	if (message.length > 1000) {
		message = message.slice(0, 1000) + '...';
	}
	console.error(message);
}

export async function runCliCommand(command) {
	try {
		log(`Running SF CLI command: ${command}`);
		const {stdout} = await execPromise(command, {maxBuffer: 100 * 1024 * 1024, cwd: CONFIG.workspacePath});
		return stdout;
	} catch (error) {
		if (error.stdout) {
			return error.stdout;
		}
		log(`Error running SF CLI command: ${JSON.stringify(error, null, 2)}`);
		throw error;
	}
}

async function makeRequest(token, method, endpoint, payload = null) {
	const headers = {
		'Authorization': `Bearer ${token}`,
		'Content-Type': 'application/json; charset=utf-8',
		'Accept': 'application/json; charset=utf-8',
		'Accept-Charset': 'utf-8'
	};

	let body = null;
	if (payload && (method === 'POST' || method === 'PATCH')) {
		body = JSON.stringify(payload, null, '\t');
	}

	log(`HTTP Request ${method} ${endpoint}`);
	log(`Headers: ${JSON.stringify(headers, null, '\t')}`);
	log(`Body: ${body}`);

	const response = await fetch(endpoint, {method, headers, body});

	log(`Response: ${response.status} ${response.statusText}`);

	if (!response.ok) {
		const errorData = await response.json();

		if (Array.isArray(errorData) && errorData[0] && errorData[0].errorCode === 'INVALID_SESSION_ID') {
			throw {type: 'INVALID_SESSION', data: errorData};
		}

		throw new Error(`Salesforce error: ${JSON.stringify(errorData)}`);
	}

	if (response.status === 204) {
		return null;
	}

	const text = await response.text();
	try {
		return JSON.parse(text);
	} catch (error) {
		log('Error parsing JSON response:', error);
		log('Raw response:', text);
		throw new Error('Invalid JSON response from Salesforce');
	}
}

async function requestAccessToken() {
	try {
		log('Requesting new access token...');

		const username = salesforceState.userDescription?.username;
		const {loginUrl, clientId, clientSecret, password} = salesforceConfig;

		if (!username || !loginUrl || !clientId || !clientSecret || !password) {
			throw new Error('Missing required environment variables for token request');
		}

		const response = await fetch(`${loginUrl}/services/oauth2/token`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
				'Accept': 'application/json; charset=utf-8',
				'Accept-Charset': 'utf-8'
			},
			body: new URLSearchParams({
				'grant_type': 'password',
				'client_id': clientId,
				'client_secret': clientSecret,
				'username': username,
				'password': password
			})
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(`Error obtaining access token: ${JSON.stringify(error)}`);
		}

		const data = await response.json();
		log('Access token successfully retrieved:', data.access_token);
		salesforceState.currentAccessToken = data.access_token;
	} catch (error) {
		log('Error obtaining access token:', error.message);
		throw error;
	}
}

export async function callSalesforceAPI(method, baseUrl = null, path = '', body = null) {
	if (!baseUrl) {
		const orgDesc = salesforceState.orgDescription;
		if (!orgDesc || !orgDesc.instanceUrl) {
			throw new Error('Org description not initialized. Please wait for server initialization.');
		}
		baseUrl = `${orgDesc.instanceUrl}/services/data/v${salesforceConfig.apiVersion}`;
	}
	const endpoint = `${baseUrl}${path}`;

	if (!salesforceState.currentAccessToken) {
		await requestAccessToken();
	}

	log(`Calling Salesforce API: endpoint ${endpoint} using version ${salesforceConfig.apiVersion}`);
	log(`Body: ${JSON.stringify(body)}`);

	try {
		const agentforceAccessToken = 'eyJ0bmsiOiJjb3JlL3Byb2QvMDBEZ0swMDAwMDFQWmZsVUFHIiwidmVyIjoiMS4wIiwia2lkIjoiQ09SRV9BVEpXVC4wMERnSzAwMDAwMVBaZmwuMTc0MjgzMzk0NjgzNiIsInR0eSI6InNmZGMtY29yZS10b2tlbiIsInR5cCI6IkpXVCIsImFsZyI6IlJTMjU2In0.eyJzY3AiOiJzZmFwX2FwaSBjaGF0Ym90X2FwaSBpZCBhcGkiLCJzdWIiOiJ1aWQ6MDA1Z0swMDAwMDFDM1BsUUFLIiwicm9sZXMiOltdLCJpc3MiOiJodHRwczovL29yZ2Zhcm0tYTViNDBlOWM1Yi1kZXYtZWQuZGV2ZWxvcC5teS5zYWxlc2ZvcmNlLmNvbSIsImNsaWVudF9pZCI6IjNNVkc5clpqZDdNWEZkTGhTS0k3YU1WRFRhcFVtSGhEbGc0dXY4bC5faVNnSEttTXJZUDBORDNramRWbzNia3dDWHJ6UUFIcTZWNXFHU3NmdFZFSDYiLCJjZHBfdGVuYW50IjoiYTM2MC9wcm9kOC9iZGZkZGY1Mzk1OWM0YzFmYmFhYmQwOGZjNTIzNjMyYiIsImF1ZCI6WyJodHRwczovL29yZ2Zhcm0tYTViNDBlOWM1Yi1kZXYtZWQuZGV2ZWxvcC5teS5zYWxlc2ZvcmNlLmNvbSIsImh0dHBzOi8vYXBpLnNhbGVzZm9yY2UuY29tIl0sIm5iZiI6MTc0NTIxNjY4NiwibXR5Ijoib2F1dGgiLCJzZmFwX3JoIjoiYm90LXN2Yy1sbG06YXdzLXByb2Q4LWNhY2VudHJhbDEvZWluc3RlaW4sbXZzL0VEQzphd3MtcHJvZDgtY2FjZW50cmFsMS9laW5zdGVpbixlaW5zdGVpbi10cmFuc2NyaWJlL0VpbnN0ZWluR1BUOmF3cy1wcm9kOC1jYWNlbnRyYWwxL2VpbnN0ZWluLGJvdC1zdmMtbGxtL0Zsb3dHcHQ6YXdzLXByb2QxLXVzZWFzdDEvZWluc3RlaW4sZWluc3RlaW4tYWktZ2F0ZXdheS9FaW5zdGVpbkdQVDphd3MtcHJvZDgtY2FjZW50cmFsMS9laW5zdGVpbixlaW5zdGVpbi1haS1nYXRld2F5L0VEQzphd3MtcHJvZDgtY2FjZW50cmFsMS9laW5zdGVpbiIsInNmaSI6ImNjOTJkZmI0NzJmZWY0MzBlODRkYWNkYThiYzhiMmIwYTc4NjIzYTYwMjRiNWJlNmI3NTYyMGUwYzEyYjczNGIiLCJzZmFwX29wIjoiRWluc3RlaW5IYXdraW5nQzJDRW5hYmxlZCxFR3B0Rm9yRGV2c0F2YWlsYWJsZSxFaW5zdGVpbkdlbmVyYXRpdmVTZXJ2aWNlIiwiaHNjIjpmYWxzZSwiY2RwX3VybCI6Imh0dHBzOi8vYTM2MC5jZHAuY2RwMi5hd3MtcHJvZDgtY2FjZW50cmFsMS5hd3Muc2ZkYy5jbCIsImV4cCI6MTc0NTIxODUwMSwiaWF0IjoxNzQ1MjE2NzAxfQ.iHyBBhfBsoEQ1IdSCwniXjm5YgjDVg-CyjFcfVEGaudcvGUHt7xIFTtb76NV4KDhbcloqMwQrmN7WipGwDlqMvBY6Cl2HwVGV8hMXrxqmmt2Q8Pp16SIe7QFRTLoKWrEHMSvhNWpbQQ31gO8C94r-Zg_KU-ombyTREXpxmOLS0dLqW-DzvAT0zQqwyZ_OXu-oVX1bNqahkkxNGPsC0D64jIBZWywMj0D7uLXxxQ-uIgbh6fscvG73jyC59gzuPu0-VoLcsp2vWDX4OYBk1GGFpRyG7ZOFjt-81f1QNq9XDqn-GrZPvp0zBZ4HkSqqQCWFoHVra7HBRLqiIK0DQw-jA';
		const token = endpoint.includes('einstein/ai-agent') ? agentforceAccessToken : salesforceState.currentAccessToken;
		const response = await makeRequest(token, method, endpoint, body);

		const responseBody = JSON.parse(response.body);

		log(`Response from Salesforce API: ${JSON.stringify(responseBody, null, '\t')}`);
		return response;
	} catch (error) {
		if (error.type === 'INVALID_SESSION') {
			log('Invalid token, attempting to obtain new access token...');
			try {
				await requestAccessToken();
			} catch (err) {
				throw new Error(`Error obtaining access token: ${err.message}`);
			}
		}
		throw error;
	}
}

export const initServer = async () => {

	//process.env.HOME = '/Users/marcpla';
	await execPromise(`export HOME=${process.env.HOME}`);
	const orgAlias = JSON.parse(await runCliCommand('sf config get target-org --json'))?.result?.[0]?.value;
	if (orgAlias) {
		salesforceState.orgDescription = JSON.parse(await runCliCommand(`sf org display -o "${orgAlias}" --json`))?.result;
		salesforceState.userDescription = JSON.parse(await runCliCommand(`sf org display user -o "${orgAlias}" --json`))?.result;
		log(`Org and user details successfully retrieved: \n\nOrg:\n${JSON.stringify(salesforceState.orgDescription, null, '\t')}\n\nUser:\n${JSON.stringify(salesforceState.userDescription, null, '\t')}`, 'debug');
	}

	const {orgDescription} = salesforceState;

	if (orgDescription?.alias) {
		//SObject definitions refresh every 2 days
		const lastRefresh = globalCache.get(orgDescription.alias, 'maintenance', 'sobjectRefreshLastRunDate');
		const now = Date.now();
		if (
			lastRefresh && now - lastRefresh > globalCache.EXPIRATION_TIME.REFRESH_SOBJECT_DEFINITIONS ||
			!lastRefresh && Math.random() < 0.1
		) {
			log('Launching sf sobject definitions refresh...');
			setTimeout(() => runCliCommand('sf sobject definitions refresh'), 172800000); //2 days
			globalCache.set(orgDescription.alias, 'maintenance', 'sobjectRefreshLastRunDate', now);
		} else if (!lastRefresh) {
			log('No last SObject definitions refresh date and not selected by probability.');
		} else {
			log('No need to refresh SObject definitions, last refresh was less than 2 days ago.');
		}

		//SF CLI update every week
		const lastSfCliUpdate = globalCache.get(orgDescription.alias, 'maintenance', 'sfCliUpdateLastRunDate');
		if (
			lastSfCliUpdate && now - lastSfCliUpdate > globalCache.EXPIRATION_TIME.UPDATE_SF_CLI ||
			!lastSfCliUpdate && Math.random() < 0.1
		) {
			log('Launching sf update...');
			setTimeout(() => runCliCommand('sf update'), 0); //immediate
			globalCache.set(orgDescription.alias, 'maintenance', 'sfCliUpdateLastRunDate', now);
		} else if (!lastSfCliUpdate) {
			log('No last SF CLI update date and not selected by probability.');
		} else {
			log('No need to update SF CLI, last update was less than a week ago.');
		}
	}
};

export function notifyProgressChange(progressToken, total, progress, message) {
	const server = salesforceState.server;
	server && server.notification({
		method: 'notifications/progress',
		params: {
			progressToken,
			progress,
			total,
			message
		}
	});
}

/**
 * Loads the markdown description for a tool from src/tools/{toolName}.md
 * @param {string} toolName - The name of the tool (e.g. 'getRecord')
 * @returns {string} The markdown content, or a warning if not found
 */
export function loadToolDescription(toolName) {
	const mdPath = path.join(__dirname, 'tools', `${toolName}.md`);
	try {
		return fs.readFileSync(mdPath, 'utf8');
	} catch (err) {
		return `No description found for tool: ${toolName}`;
	}
}