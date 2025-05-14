/*globals process */
import fetch from 'node-fetch';
import {execSync} from 'child_process';
import {getCurrentAccessToken, setCurrentAccessToken, getOrgDescription} from '../index.js';

const salesforceConfig = {
	apiVersion: process.env.apiVersion || '63.0',
	loginUrl: process.env.loginUrl || 'https://test.salesforce.com',
	clientId: process.env.clientId,
	clientSecret: process.env.clientSecret,
	username: process.env.username,
	password: process.env.password
};

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

	console.error('');
	console.error('');
	console.error(`HTTP Request ${method} ${endpoint}`);
	console.error(`Headers: ${JSON.stringify(headers, null, '\t')}`);
	console.error(`Body: ${body}`);

	const response = await fetch(endpoint, {method, headers, body});

	console.error('');
	console.error(`Response: ${response.status} ${response.statusText}`);

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
		console.error('Error parsing JSON response:', error);
		console.error('Raw response:', text);
		throw new Error('Invalid JSON response from Salesforce');
	}
}

async function requestAccessToken() {
	try {
		console.error('Requesting new access token...');

		const {loginUrl, clientId, clientSecret, username, password} = salesforceConfig;

		if (!loginUrl || !clientId || !clientSecret || !username || !password) {
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
		console.error('Access token successfully retrieved:', data.access_token);
		setCurrentAccessToken(data.access_token);
	} catch (error) {
		console.error('Error obtaining access token:', error.message);
		throw error;
	}
}

async function callSalesforceAPI(method, baseUrl = null, path = '', body = null) {
	if (!baseUrl) {
		const orgDesc = getOrgDescription();
		if (!orgDesc || !orgDesc.instanceUrl) {
			throw new Error('Org description not initialized. Please wait for server initialization.');
		}
		baseUrl = `${orgDesc.instanceUrl}/services/data/v${salesforceConfig.apiVersion}`;
	}
	const endpoint = `${baseUrl}${path}`;

	if (!getCurrentAccessToken()) {
		await requestAccessToken();
	}

	console.error('');
	console.error(`Calling Salesforce API: endpoint ${endpoint} using version ${process.env.apiVersion}`);
	console.error(`Body: ${JSON.stringify(body)}`);

	try {
		const agentforceAccessToken = 'eyJ0bmsiOiJjb3JlL3Byb2QvMDBEZ0swMDAwMDFQWmZsVUFHIiwidmVyIjoiMS4wIiwia2lkIjoiQ09SRV9BVEpXVC4wMERnSzAwMDAwMVBaZmwuMTc0MjgzMzk0NjgzNiIsInR0eSI6InNmZGMtY29yZS10b2tlbiIsInR5cCI6IkpXVCIsImFsZyI6IlJTMjU2In0.eyJzY3AiOiJzZmFwX2FwaSBjaGF0Ym90X2FwaSBpZCBhcGkiLCJzdWIiOiJ1aWQ6MDA1Z0swMDAwMDFDM1BsUUFLIiwicm9sZXMiOltdLCJpc3MiOiJodHRwczovL29yZ2Zhcm0tYTViNDBlOWM1Yi1kZXYtZWQuZGV2ZWxvcC5teS5zYWxlc2ZvcmNlLmNvbSIsImNsaWVudF9pZCI6IjNNVkc5clpqZDdNWEZkTGhTS0k3YU1WRFRhcFVtSGhEbGc0dXY4bC5faVNnSEttTXJZUDBORDNramRWbzNia3dDWHJ6UUFIcTZWNXFHU3NmdFZFSDYiLCJjZHBfdGVuYW50IjoiYTM2MC9wcm9kOC9iZGZkZGY1Mzk1OWM0YzFmYmFhYmQwOGZjNTIzNjMyYiIsImF1ZCI6WyJodHRwczovL29yZ2Zhcm0tYTViNDBlOWM1Yi1kZXYtZWQuZGV2ZWxvcC5teS5zYWxlc2ZvcmNlLmNvbSIsImh0dHBzOi8vYXBpLnNhbGVzZm9yY2UuY29tIl0sIm5iZiI6MTc0NTIxNjY4NiwibXR5Ijoib2F1dGgiLCJzZmFwX3JoIjoiYm90LXN2Yy1sbG06YXdzLXByb2Q4LWNhY2VudHJhbDEvZWluc3RlaW4sbXZzL0VEQzphd3MtcHJvZDgtY2FjZW50cmFsMS9laW5zdGVpbixlaW5zdGVpbi10cmFuc2NyaWJlL0VpbnN0ZWluR1BUOmF3cy1wcm9kOC1jYWNlbnRyYWwxL2VpbnN0ZWluLGJvdC1zdmMtbGxtL0Zsb3dHcHQ6YXdzLXByb2QxLXVzZWFzdDEvZWluc3RlaW4sZWluc3RlaW4tYWktZ2F0ZXdheS9FaW5zdGVpbkdQVDphd3MtcHJvZDgtY2FjZW50cmFsMS9laW5zdGVpbixlaW5zdGVpbi1haS1nYXRld2F5L0VEQzphd3MtcHJvZDgtY2FjZW50cmFsMS9laW5zdGVpbiIsInNmaSI6ImNjOTJkZmI0NzJmZWY0MzBlODRkYWNkYThiYzhiMmIwYTc4NjIzYTYwMjRiNWJlNmI3NTYyMGUwYzEyYjczNGIiLCJzZmFwX29wIjoiRWluc3RlaW5IYXdraW5nQzJDRW5hYmxlZCxFR3B0Rm9yRGV2c0F2YWlsYWJsZSxFaW5zdGVpbkdlbmVyYXRpdmVTZXJ2aWNlIiwiaHNjIjpmYWxzZSwiY2RwX3VybCI6Imh0dHBzOi8vYTM2MC5jZHAuY2RwMi5hd3MtcHJvZDgtY2FjZW50cmFsMS5hd3Muc2ZkYy5jbCIsImV4cCI6MTc0NTIxODUwMSwiaWF0IjoxNzQ1MjE2NzAxfQ.iHyBBhfBsoEQ1IdSCwniXjm5YgjDVg-CyjFcfVEGaudcvGUHt7xIFTtb76NV4KDhbcloqMwQrmN7WipGwDlqMvBY6Cl2HwVGV8hMXrxqmmt2Q8Pp16SIe7QFRTLoKWrEHMSvhNWpbQQ31gO8C94r-Zg_KU-ombyTREXpxmOLS0dLqW-DzvAT0zQqwyZ_OXu-oVX1bNqahkkxNGPsC0D64jIBZWywMj0D7uLXxxQ-uIgbh6fscvG73jyC59gzuPu0-VoLcsp2vWDX4OYBk1GGFpRyG7ZOFjt-81f1QNq9XDqn-GrZPvp0zBZ4HkSqqQCWFoHVra7HBRLqiIK0DQw-jA';
		const token = endpoint.includes('einstein/ai-agent') ? agentforceAccessToken : getCurrentAccessToken();
		return await makeRequest(token, method, endpoint, body);
	} catch (error) {
		if (error.type === 'INVALID_SESSION') {
			console.error('Invalid token, attempting to obtain new access token...');
			try {
				await requestAccessToken();
			} catch (err) {
				throw new Error(`Error obtaining access token: ${err.message}`);
			}
		}
		throw error;
	}
}

async function initServer() {
	console.error('Retrieving org details...');
	process.env.HOME = '/Users/marcpla';
	const home = execSync(`export HOME=${process.env.HOME}`);
	const orgDescription = (await runCliCommand(`sf org display -o ${process.env.username} --json`)).result;
	console.error('Org details successfully retrieved: ', JSON.stringify(orgDescription, null, 2));
	const userDescription = (await runCliCommand(`sf org display user -o ${process.env.username} --json`)).result;
	console.error('User details successfully retrieved: ', JSON.stringify(userDescription, null, 2));
	return {orgDescription, userDescription};
}

async function runCliCommand(command) {
	try {
		console.error('');
		console.error('Running SF CLI command: ', command);
		const result = JSON.parse(execSync(command, {encoding: 'utf-8'}));
		console.error('');
		console.error('CLI command result:');
		console.error(result);
		return result;
	} catch (error) {
		console.error('');
		console.error('Error running SF CLI command:', error);
		throw error;
	}
}

export {
	callSalesforceAPI,
	initServer,
	runCliCommand
};