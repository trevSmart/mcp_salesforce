import {CONFIG} from './config.js';
import {setResource} from './utils.js';

let org = {};
let mcpServer;
let server = {};
let client = {clientInfo: {isVscode: false}};
let resources = {
	'mcp://org/org-and-user-details.json': null
};

export const state = {
	get workspacePath() {
		return CONFIG.workspacePath;
	},
	get resources() {
		return resources;
	},
	set resources(newResources) {
		resources = newResources;
	},
	get org() {
		return org;
	},
	set org(newOrg) {
		org = newOrg;
		setResource('mcp://org/org-and-user-details.json', newOrg);
	},

	get mcpServer() {
		return mcpServer;
	},
	set mcpServer(newMcpServer) {
		mcpServer = newMcpServer;
	},

	get server() {
		return server;
	},
	set server(newServer) {
		server = newServer;
	},

	get client() {
		return client;
	},
	set client(newClient) {
		client = newClient;
	},

	get currentAccessToken() {
		return org?.accessToken;
	},
	set currentAccessToken(newAccessToken) {
		if (org) {
			org.accessToken = newAccessToken;
		}
	}
};

export default state;