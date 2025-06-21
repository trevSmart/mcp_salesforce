let orgDescription;
let userDescription;
let server;

export const salesforceState = {
	get orgDescription() {
		return orgDescription;
	},
	set orgDescription(newOrgDescription) {
		orgDescription = newOrgDescription;
	},

	get userDescription() {
		return userDescription;
	},
	set userDescription(newUserDescription) {
		userDescription = newUserDescription;
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
	},
};