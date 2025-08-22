# Test Structure

Aquest directori conté tots els tests del projecte IBM Salesforce MCP.

## Estructura

```
test/
├── runner.js              # Executor principal de tests
├── mcp-client.js          # Client MCP per comunicar-se amb el servidor
├── helpers.js             # Funcions auxiliars i gestió d'infraestructura
├── config.js              # Configuració dels tests
├── suites/                # Suites de tests organitzades per funcionalitat
│   └── mcp-tools.js       # Tests de les tools MCP
└── fixtures/              # Dades de test (futur)
```

## Com Executar els Tests

### Executar tots els tests
```bash
npm test
```

### Executar tests específics
```bash
npm test -- --tests=apexDebugLogs,getRecord
```

### Establir nivell de log
```bash
npm test -- --logLevel=debug
```

### Veure ajuda
```bash
npm run test:help
```

## Organització del Codi

### `runner.js`
- Coordina l'execució de tots els tests
- Gestiona el cicle de vida del servidor MCP
- Mostra resums i resultats dels tests

### `mcp-client.js`
- Implementa la comunicació amb el servidor MCP
- Gestiona missatges JSON-RPC
- Manté l'estat de les tools disponibles

### `helpers.js`
- **MCPServerManager**: Gestiona l'inici i aturada del servidor MCP
- **SalesforceOrgManager**: Gestiona el canvi d'orgs de Salesforce
- **TestHelpers**: Funcions auxiliars per tests

### `config.js`
- Configuració centralitzada dels tests
- Constants per colors, timeouts, i configuracions

### `suites/mcp-tools.js`
- Conté tots els tests de les tools MCP
- Organitza els tests per funcionalitat
- Permet executar tests específics o tots

## Afegir Nous Tests

Per afegir nous tests:

1. **Tests de tools MCP**: Afegeix-los a `suites/mcp-tools.js`
2. **Tests unitaris**: Crea `suites/unit.js`
3. **Tests d'integració**: Crea `suites/integration.js`

## Exemple d'Afegir un Test

```javascript
// A suites/mcp-tools.js
{
  name: 'Nou Test',
  run: async () => {
    await this.mcpClient.callTool('toolName', {param: 'value'});
  }
}
```

## Avantatges de la Nova Estructura

1. **Separació de responsabilitats**: Cada fitxer té una funció específica
2. **Reutilització**: El client MCP i helpers es comparteixen entre tests
3. **Mantenibilitat**: Fàcil trobar i modificar tests específics
4. **Escalabilitat**: Fàcil afegir nous tipus de tests
5. **Configuració centralitzada**: Tots els paràmetres en un sol lloc
