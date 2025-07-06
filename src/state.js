let orgDescription;
let server;

export const salesforceState = {
	get orgDescription() {
		return orgDescription;
	},
	set orgDescription(newOrgDescription) {
		orgDescription = newOrgDescription;
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