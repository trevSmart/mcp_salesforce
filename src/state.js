import envPaths from 'env-paths';
import config from './config.js';
import path from 'path';

const state = {
	org: {},
	currentLogLevel: process.env.LOG_LEVEL || 'info',
	userValidated: true,
	workspacePath: process.env.WORKSPACE_FOLDER_PATHS || '',
	tempPath: envPaths(config.SERVER_CONSTANTS.serverInfo.alias).data || path.join(process.cwd(), 'tmp'),
	startedDate: new Date()
};

export default state;
