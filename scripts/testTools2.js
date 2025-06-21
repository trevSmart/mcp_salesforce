import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';

const tests = [
	{
		name: 'executeSoqlQuery',
		args: {query: 'SELECT Id, Name FROM Account LIMIT 3'}
	},
	{
		name: 'executeSoqlQuery',
		args: {query: 'SELECT Id, Name FROM Account WHERE Name = \'NO_EXISTEIX\' LIMIT 1'}
	},
	{
		name: 'executeSoqlQuery',
		args: {query: 'SELECT Id, Name FROM Account WHERE'} //Error de sintaxi
	}
];

//Funció auxiliar per esperar que tools/list retorni resultats
async function waitForToolsList(client, maxWaitMs = 30000) {
	const start = Date.now();
	while (Date.now() - start < maxWaitMs) {
		try {
			const request = {method: 'tools/list', params: {}};
			const response = await client.request(null, request);
			if (response && response.tools && response.tools.length > 0) {return response}
		} catch (err) {
			//Espera i reintenta si falla
		}
		await new Promise(res => setTimeout(res, 2000));
	}
	throw new Error('Timeout esperant tools/list');
}

(async () => {
	//Inicialitza el transport stdio (el client MCP parla per stdin/stdout)
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: ['/Users/marcpla/Documents/Feina/Projectes/mcp/mcp_salesforce/index.js'],
		cwd: '/Users/marcpla/Documents/Feina/Projectes/mcp/mcp_salesforce',
		env: {
			SF_MCP_CONNECTED_APP_CLIENT_ID: '3MVG96MLzwkgoRznOeS464zHp_vAzQreoRiXMD4cPtI8NIBf12iFF7wtw1Kuh5uD27NBvVYbDlnRMPOmMl.lP',
			SF_MCP_CONNECTED_APP_CLIENT_SECRET: 'D541294765A7E849F47098E3DC9E7238C35D765126F8D6C6D1E134A87335DB16',
			SF_MCP_PASSWORD: 'trompeta5o7uZnnhiJxJoxEfCfonlyPSM',
			SF_MCP_AGENTFORCE_AGENT_ID: '0XxKN0000008OKp'
		}
	});
	const client = new Client({name: 'MyToolTester', version: '1.0.0'});
	await client.connect(transport);

	console.log('\n--------------------------------');
	console.log('--- Llistant tools disponibles ---');
	try {
	    const response = await waitForToolsList(client);
	    console.log('Llista de tools disponibles:', JSON.stringify(response, null, 2));
	} catch (err) {
	    console.error('❌ Error llistant tools:', err);
	}

	//Tanca la connexió
	await client.close();
})();