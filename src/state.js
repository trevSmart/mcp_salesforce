let org = {};
let currentLogLevel = process.env.LOG_LEVEL || 'info';
let userValidated = true;

export default {
	get org() {
		return org;
	},
	set org(newOrg) {
		org = newOrg;
	},

	get currentLogLevel() {
		return currentLogLevel;
	},
	set currentLogLevel(level) {
		currentLogLevel = level;
	},

	get userValidated() {
		return userValidated;
	},
	set userValidated(validated) {
		userValidated = validated;
	}
};