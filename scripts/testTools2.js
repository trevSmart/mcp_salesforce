import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';

const tests = [
	{name: 'soqlQuery', args: {query: 'SELECT Id, Name FROM Account LIMIT 5'}},
	{name: 'orgDetails', args: {}},
	{name: 'currentUserDetails', args: {}},
	{name: 'generateSoqlQuery', args: {soqlQueryDescription: 'Llista tots els comptes', involvedSObjects: ['Account']}},
	//Afegeix aquí tantes proves com vulguis
];

(async () => {
	//Inicialitza el transport stdio (el client MCP parla per stdin/stdout)
	const transport = new StdioClientTransport();
	const client = new Client(transport);

	await client.connect();

	for (const test of tests) {
		console.log('\n--------------------------------');
		console.log(`--- Test: ${test.name} ---`);
		try {
			const request = {
				params: {
					name: test.name,
					arguments: test.args
				}
			};
			const response = await client.request(CallToolRequestSchema, request);
			if (response.isError) {
				console.error(`❌ ${test.name} ERROR:`, response.content?.[0]?.text || response);
			} else {
				console.log(`✅ ${test.name} OK:`, JSON.stringify(response, null, 2));
			}
		} catch (err) {
			console.error(`❌ ${test.name} EXCEPTION:`, err);
		}
		//Espera 1 segon entre proves per evitar saturar el servidor
		await new Promise(resolve => setTimeout(resolve, 1000));
	}

	//Tanca la connexió
	await client.disconnect();
})();