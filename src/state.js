import {setResource} from '../index.js';

let org = {};
let server = {};
let client = {};

const state = {
	get org() {
		return org			;
	},
	set org(newOrg) {
		org = newOrg;
		setResource('mcp://org/org-and-user-details.json', newOrg);
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