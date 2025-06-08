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

//Ruta absoluta de l'index.js
const indexPath = path.resolve(__dirname, '../index.js');

//Genera la config per al deeplink
const envVars = {};
envRaw.split('\n').forEach(line => {
	const [key, ...vals] = line.split('=');
	if (key && vals.length > 0) {
		envVars[key.trim()] = vals.join('=').trim();
	}
});

const config = {
	command: 'node',
	args: [indexPath],
	env: envVars
};
const configBase64 = Buffer.from(JSON.stringify(config)).toString('base64');
const deeplink = `cursor://anysphere.cursor-deeplink/mcp/install?name=salesforce-mcp&config=${configBase64}`;

//Llegeix el README.md
const readmePath = path.resolve(__dirname, '../README.md');
let readme = fs.readFileSync(readmePath, 'utf8');

//Regex per trobar el bloc deeplink
const deeplinkRegex = /cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?name=salesforce-mcp&config=[^\n`"]+/g;

if (deeplinkRegex.test(readme)) {
	//Substitueix el deeplink existent
	readme = readme.replace(deeplinkRegex, deeplink);
} else {
	//Si no existeix, afegeix-lo al final
	readme += `\n\n${deeplink}\n`;
}

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