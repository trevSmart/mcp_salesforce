# Execució de Tests amb Client MCP Compartit

Aquest projecte utilitza un client MCP compartit per a tots els tests, millorant significativament el rendiment en executar múltiples tests.

## Com funciona

En lloc de crear un nou client MCP per a cada fitxer de test, utilitzem un sol client global que es comparteix entre tots els tests. Això s'aconsegueix mitjançant:

1. Un client MCP global creat a `__tests__/setup.js`
2. Configuració de Jest per utilitzar aquest fitxer de configuració global
3. Cada fitxer de test accedeix al client global en lloc de crear-ne un de nou

## Avantatges

- **Rendiment millorat**: Només s'inicia un servidor MCP per a tots els tests
- **Menys recursos**: Menys processos i connexions simultànies
- **Tests més ràpids**: Eliminació de l'overhead de crear i destruir clients per cada test

## Com executar els tests

Per executar tots els tests:

```bash
npm test
```

Per executar un test específic:

```bash
npm test -- -t "nom del test"
```

Per executar tests d'un fitxer específic:

```bash
npm test -- __tests__/tools/apexDebugLogs.test.js
```

## Estructura dels fitxers de test

Cada fitxer de test segueix aquesta estructura:

```javascript
describe('nomDelTool', () => {
  let client;

  beforeAll(() => {
    // Utilitzar el client global compartit
    client = global.sharedMcpClient;
    // No fem assert aquí, ho farem al primer test
  });

  test('primer test', async () => {
    // Verificar que el client està definit
    expect(client).toBeDefined();

    // Resta del test...
  });

  // Més tests...
});
```

## Manteniment

Si necessites afegir un nou fitxer de test, segueix el patró anterior. No cal crear un nou client ni desconnectar-lo al final, ja que això es fa automàticament al fitxer de configuració global.
