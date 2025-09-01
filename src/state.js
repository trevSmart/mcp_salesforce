import path from 'path';

const state = {
	org: {},
	currentLogLevel: process.env.LOG_LEVEL || 'info',
	userValidated: true,
	workspacePath: process.env.WORKSPACE_FOLDER_PATHS || '',
	tempPath: process.env.WORKSPACE_FOLDER_PATHS ? path.join(process.env.WORKSPACE_FOLDER_PATHS, 'tmp') : null,
	startedDate: new Date()
};

export default state;