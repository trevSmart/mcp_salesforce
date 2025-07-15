import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

//Obté __dirname equivalent en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Carrega variables d'entorn del .env, ignorant línies comentades
const envPath = path.resolve(__dirname, '../.env');
let envRaw = fs.readFileSync(envPath, 'utf8');
//Elimina línies que comencen per # (comentaris)
envRaw = envRaw.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');

//Assigna les variables del .env a process.env
envRaw.split('\n').forEach(line => {
	const [key, ...vals] = line.split('=');
	if (key && vals.length > 0) {
		process.env[key.trim()] = vals.join('=').trim();
	}
});


//Genera la config per al deeplink
const envVars = {};
envRaw.split('\n').forEach(line => {
	const [key, ...vals] = line.split('=');
	if (key && vals.length > 0) {
		envVars[key.trim()] = vals.join('=').trim();
	}
});

//Cursor deeplink
const cfgCursorBase64 = Buffer.from(JSON.stringify({command: 'npx', args: ['test_research4'], env: {}})).toString('base64');
const deeplinkCursor = `cursor://anysphere.cursor-deeplink/mcp/install?name=ibm-salesforce-mcp&config=${cfgCursorBase64}`;

//VSCode deeplink
const deeplinkVSCode = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({
	name: 'ibm-salesforce-mcp', command: 'npx', args: ['test_research4']
}))}`;

//Llegeix el README.md
const readmePath = path.resolve(__dirname, '../README.md');
let readme = fs.readFileSync(readmePath, 'utf8');

//Regex per trobar la línia Markdown de l'enllaç deeplink
const markdownDeeplinkRegex = /\[!\[Install MCP Server\]\(https:\/\/cursor\.com\/deeplink\/mcp-install-dark\.svg\)\]\(cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?name=ibm-salesforce-mcp&config=[^\n`)]*\)/g;
const markdownDeeplinkLine = `[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](${deeplink})`;

if (markdownDeeplinkRegex.test(readme)) {
	//Substitueix tota la línia Markdown de l'enllaç
	readme = readme.replace(markdownDeeplinkRegex, markdownDeeplinkLine);
} else {
	//Si no existeix, afegeix la línia Markdown nova al final
	readme += `\n\n${markdownDeeplinkLine}\n`;
}







const link = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({
	name: 'ibm-salesforce-mcp',
	command: 'npx',
	args: ['test_research4']
}))}`;








console.log('');
console.log('Updating Cursor deeplink in README.md...');

try {
	fs.writeFileSync(readmePath, readme, 'utf8');
	console.log('Cursor deeplink successfully updated in README.md.');
	console.log('');
	process.exit(0);

} catch (error) {
	console.error('❌ Error updating README.md:', error.message);
	console.log('');
	process.exit(1);
}