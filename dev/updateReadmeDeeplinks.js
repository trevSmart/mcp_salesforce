import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

//Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Load .env variables, ignoring commented lines
const envPath = path.resolve(__dirname, '../.env');
let envRaw = fs.readFileSync(envPath, 'utf8');
envRaw = envRaw.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');

envRaw.split('\n').forEach(line => {
	const [key, ...vals] = line.split('=');
	if (key && vals.length > 0) {
		process.env[key.trim()] = vals.join('=').trim();
	}
});

//Generate deeplink configs
const cfgCursorBase64 = Buffer.from(JSON.stringify({command: 'npx', args: ['test_research4'], env: {}})).toString('base64');
const deeplinkCursor = `cursor://anysphere.cursor-deeplink/mcp/install?name=ibm-salesforce-mcp&config=${cfgCursorBase64}`;
const deeplinkVSCode = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({name: 'ibm-salesforce-mcp', command: 'npx', args: ['test_research4']}))}`;

//Markdown lines for each button
const markdownCursor = `[![Install MCP Server (Cursor)](https://cursor.com/deeplink/mcp-install-dark.svg)](${deeplinkCursor})`;
const markdownVSCode = `[![Install MCP Server (VSCode)](https://cursor.com/deeplink/mcp-install-dark.svg)](${deeplinkVSCode})`;

//Read README.md
const readmePath = path.resolve(__dirname, '../README.md');
let readme = fs.readFileSync(readmePath, 'utf8');

//Regex for each button line
const regexCursor = /\[!\[Install MCP Server( \(Cursor\))?\]\(https:\/\/cursor\.com\/deeplink\/mcp-install-dark\.svg\)\]\(cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?name=ibm-salesforce-mcp&config=[^\n`)]*\)/g;
const regexVSCode = /\[!\[Install MCP Server( \(VSCode\))?\]\(https:\/\/cursor\.com\/deeplink\/mcp-install-dark\.svg\)\]\(vscode:mcp\/install\?[^\n`)]*\)/g;

//Update or append Cursor deeplink
if (regexCursor.test(readme)) {
	readme = readme.replace(regexCursor, markdownCursor);
} else {
	readme += `\n\n${markdownCursor}\n`;
}

//Update or append VSCode deeplink
if (regexVSCode.test(readme)) {
	readme = readme.replace(regexVSCode, markdownVSCode);
} else {
	readme += `\n\n${markdownVSCode}\n`;
}

console.log('');
console.log('Updating Cursor and VSCode deeplinks in README.md...');

try {
	fs.writeFileSync(readmePath, readme, 'utf8');
	console.log('Deeplinks successfully updated in README.md.');
	console.log('');
	process.exit(0);
} catch (error) {
	console.error('❌ Error updating README.md:', error.message);
	console.log('');
	process.exit(1);
}