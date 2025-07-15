# Projecte en fase de proves

Aquest projecte està en desenvolupament i no està preparat per a ús públic.

## Característiques


## Requisits

- Node.js v14 o superior
- CLI de Salesforce connectat a una org (només per a proves internes)
- IDE o eina compatible amb MCP (només per a proves internes)

## Configuració

Crea un fitxer `.env` a l'arrel del projecte amb les variables necessàries per a la connexió (consulta l'equip de desenvolupament per als detalls).

# Instal·lació

- #### Afegeix a VSCode:
	[Add to VSCode](vscode:mcp/install?%7B%22name%22%3A%22ibm-salesforce-mcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22test_research4%22%5D%7D)

- #### Afegeix a Cursor:
	[Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=ibm-salesforce-mcp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyJ0ZXN0X3Jlc2VhcmNoNCJdLCJlbnYiOnt9fQ==)

- #### Afegeix a altres clients
```json
{
	"mcpServers": {
		"ibm-salesforce-mcp": {
			"command": "npx",
			"args": [
				"test_research4"
			],
			"env": {
				"SF_MCP_AGENTFORCE_AGENT_ID": "0XxKN0000008OKp"
			}
		}
	}
}
```

> **Nota:** Aquest projecte està en fase de proves. No el facis servir en entorns de producció ni el distribueixis.

## Llicència

Consulta el fitxer LICENSE per als detalls de la llicència.
