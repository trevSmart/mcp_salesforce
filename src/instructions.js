import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

// Standalone helper to load agent instructions without importing config or utils (avoids cycles)
export function getAgentInstructions(name) {
	try {
		const localFilename = fileURLToPath(import.meta.url);
		const localDirname = path.dirname(localFilename);
		const staticPath = path.join(localDirname, 'static', `${name}.md`);

		if (fs.existsSync(staticPath)) {
			return fs.readFileSync(staticPath, 'utf8');
		}
		return '';
	} catch {
		// Avoid logging here to keep this module cycle-free
		return '';
	}
}

export default getAgentInstructions;

