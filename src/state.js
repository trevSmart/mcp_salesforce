const state = {
	org: {},
	currentLogLevel: process.env.LOG_LEVEL || 'info',
	userValidated: true,
	workspacePath: process.env.WORKSPACE_FOLDER_PATHS || ''
};

export default state;
