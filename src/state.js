import {setResource} from '../index.js';

let org = {};
let mcpServer;
let server = {};
let client = {
	clientInfo: {
		isVscode: false
	}
};

export const state = {
	get org() {
		return org			;
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