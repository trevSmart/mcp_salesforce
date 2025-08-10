import {config} from './config.js';
let org = {};

export default {
	get workspacePath() {
		return config.workspacePath;
	},
	get org() {
		return org;
	},
	set org(newOrg) {
		org = newOrg;
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