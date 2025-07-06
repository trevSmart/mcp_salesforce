# Projecte en fase de proves

Aquest projecte està en desenvolupament i no està preparat per a ús públic.

## Característiques

- Consulta, creació, actualització i eliminació de registres
- Deploy i recuperació de metadades
- Execució de scripts anònims
- Generació de consultes automàtiques
- Gestió de logs de depuració
- Revisió de canvis de configuració
- Integració amb agents externs

## Requisits

- Node.js v14 o superior
- CLI de Salesforce connectat a una org (només per a proves internes)
- IDE o eina compatible amb MCP (només per a proves internes)

## Configuració

Crea un fitxer `.env` a l'arrel del projecte amb les variables necessàries per a la connexió (consulta l'equip de desenvolupament per als detalls).

## Ús

Inicia el servidor amb:

```bash
node index.js
```

Un cop el servidor estigui en execució, connecta-t'hi des de l'IDE o eina corresponent.

## Connecta des de Cursor IDE

Pots instal·lar i llançar el servidor directament des de Cursor utilitzant el deeplink proporcionat per l'equip de desenvolupament.

> **Nota:** Aquest projecte està en fase de proves. No el facis servir en entorns de producció ni el distribueixis.

## Llicència

Consulta el fitxer LICENSE per als detalls de la llicència.

cursor://anysphere.cursor-deeplink/mcp/install?name=salesforce-mcp&config=eyJjb21tYW5kIjoibm9kZSIsImFyZ3MiOlsiL1VzZXJzL21hcmNwbGEvRG9jdW1lbnRzL0ZlaW5hL1Byb2plY3Rlcy9tY3AvbWNwX3NhbGVzZm9yY2UvaW5kZXguanMiXSwiZW52Ijp7IlNmQWdlbnRmb3JjZUFnZW50SWQiOiJZT1VSX0FHRU5URk9SQ0VfSUQifX0=
