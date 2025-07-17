class Config {
	constructor() {
		this.currentLogLevel = 'info'; //7:debug, 6:info, 5:notice, 4:warning, 3:error, 2:critical, 1:alert, 0:emergency
		this.logPrefix = '(👁🐝Ⓜ️)';

		this.workspacePath = process.env.WORKSPACE_FOLDER_PATHS || '';
	}

	setLogLevel(level) {
		this.currentLogLevel = level;
	}

	setWorkspacePath(path) {
		//Remove file:// protocol if present
		if (typeof path === 'string' && path.startsWith('file://')) {
			this.workspacePath = path.replace(/^file:\/\//, '');
		} else {
			this.workspacePath = path;
		}
	}
}

export const CONFIG = new Config();