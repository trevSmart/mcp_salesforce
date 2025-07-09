//import {setResource} from '../index.js';

let orgDescription;
let server;

const state = {
	get orgDescription() {
		return orgDescription;
	},
	set orgDescription(newOrgDescription) {
		orgDescription = newOrgDescription;
		//setResource('mcp://org/org-and-user-details.json', newOrgDescription);
	},

	get server() {
		return server;
	},
	set server(newServer) {
		server = newServer;
	},

	get currentAccessToken() {
		return orgDescription?.accessToken;
	},
	set currentAccessToken(newAccessToken) {
		if (orgDescription) {
			orgDescription.accessToken = newAccessToken;
		}
	}
};

export default state;