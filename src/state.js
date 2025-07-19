import {CONFIG} from './config.js';
import {newResource} from './mcp-server.js';

let org = {};

export default {
	get workspacePath() {
		return CONFIG.workspacePath;
	},
	get org() {
		return org;
	},
	set org(newOrg) {
		org = newOrg;
		newResource('mcp://org/org-and-user-details.json', 'application/json', newOrg);
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