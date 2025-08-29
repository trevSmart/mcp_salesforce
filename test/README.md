# Test Structure

Aquest directori conté tots els tests del projecte IBM Salesforce MCP.

## Estructura

```
test/
├── runner.js              # Executor principal de tests (usa `ibm-test-mcp-client`)
├── helpers.js             # Funcions auxiliars i gestió d'infraestructura
├── test-config.js         # Configuració dels tests
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

### Modes de sortida
```bash
# Sortida compacta (amaga el detall de les tools)
npm test -- --compact

# Sortida mínima (una línia per test)
npm test -- --quiet
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

### Client MCP
- El `runner.js` utilitza el paquet `ibm-test-mcp-client` per iniciar i gestionar la connexió MCP (via stdio).
- Funcions clau disponibles al client: `connect`, `disconnect`, `setLoggingLevel`, `listTools`, `callTool`.

### `helpers.js`
- **MCPServerManager**: Gestiona l'inici i aturada del servidor MCP
- **SalesforceOrgManager**: Gestiona el canvi d'orgs de Salesforce
- **TestHelpers**: Funcions auxiliars per tests

### `test-config.js`
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
