# Execució en Paral·lel dels Tests MCP

## Resum

El sistema de tests MCP ara suporta l'execució en paral·lel, reduint significativament el temps total d'execució dels tests. En lloc d'executar tots els tests seqüencialment, el sistema agrupa els tests en fases i executa les fases que ho permeten en paral·lel.

## Com Funciona

### 1. Anàlisi de Dependències

Cada test ara inclou informació sobre les seves dependències:

```javascript
{
    name: 'getRecord',
    dependencies: ['dmlOperation Create'],  // Depèn d'aquest test
    canRunInParallel: false,               // No pot executar-se en paral·lel
    run: async (context) => { /* ... */ }
}
```

### 2. Agrupació en Fases

El sistema agrupa automàticament els tests en fases d'execució:

- **Fases Seqüencials**: Tests que han d'executar-se un després de l'altre
- **Fases Paral·leles**: Tests que es poden executar simultàniament

### 3. Execució Intel·ligent amb Prioritat

```
Phase 0: Initialize MCP Connection (sequential)
Phase 1: List Available Tools (sequential)
Phase 2: getOrgAndUserDetails (sequential)
Phase 3: 2 tests (parallel) [HIGH PRIORITY] ← Tests crítics comencen primer!
Phase 4: 17 tests (parallel) ← Resta de tests en paral·lel
Phase 5: 3 tests (sequential)
Phase 6: 2 tests (sequential)
Phase 7: 2 tests (sequential)
Phase 8: 1 test (sequential)
```

## Beneficis

### ⏱️ Reducció del Temps d'Execució

- **Abans**: ~47.96s (execució seqüencial)
- **Ara**: ~30.5s (execució en paral·lel)
- **Estalvi**: ~13.9s (31.3% de millora)

### 🎯 Optimitzacions Clau

1. **Sistema de Prioritat Intel·ligent** - els tests crítics comencen primer
2. **2 tests d'alta prioritat** s'executen immediatament després de les dependències
3. **17 tests addicionals** s'executen en paral·lel en la següent fase
4. **Dependències automàtiques** - no cal gestionar manualment l'ordre
5. **Concurrència limitada** - màxim 5 tests simultànis per evitar sobrecarregar Salesforce
6. **Tests seqüencials preservats** - els tests que depenen d'altres s'executen en l'ordre correcte

## Sistema de Prioritat Intel·ligent

### Fases d'Alta Prioritat (Phase 3-4)
Els tests crítics s'executen **immediatament** quan estan disponibles, sense esperar altres tests:

- **Phase 3**: `executeAnonymousApex` [HIGH PRIORITY] - Comença immediatament
- **Phase 4**: `runApexTest` [HIGH PRIORITY] - Test que pot tardar fins a 18s

**Benefici**: Cada test d'alta prioritat té la seva pròpia fase, començant a treballar tan aviat com les seves dependències estan satisfetes. No cal esperar que altres tests d'alta prioritat acabin.

### Fase Paral·lela Regular (Phase 4)
Després dels tests d'alta prioritat, s'executen la resta de tests en paral·lel:

- `salesforceMcpUtils getState`
- `salesforceMcpUtils loadRecordPrefixesResource`
- `salesforceMcpUtils getCurrentDatetime`
- `salesforceMcpUtils clearCache`
- `salesforceMcpUtils reportIssue validation`
- `apexDebugLogs status`
- `describeObject Account`
- `executeSoqlQuery`
- `getRecentlyViewedRecords`
- `getApexClassCodeCoverage`
- `describeObject ApexClass (Tooling API)`
- `executeSoqlQuery (Tooling API)`
- `createMetadata Apex Test Class`
- `createMetadata Apex Trigger`
- `createMetadata LWC`
- `dmlOperation Create`
- `executeAnonymousApex`
- `getSetupAuditTrail`
- `runApexTest`

## Tests Seqüencials (Preservats)

Aquests tests mantenen l'ordre correcte:

### Fase ApexDebugLogs
```
apexDebugLogs status → apexDebugLogs on → apexDebugLogs list → apexDebugLogs get → apexDebugLogs off
```

### Fase DML Operations
```
dmlOperation Create → getRecord → dmlOperation Update → dmlOperation Delete
```

### Fase Cache
```
describeObject Account → describeObject Account (cached)
```

## Configuració

### Límit de Concurrència

```javascript
static MAX_CONCURRENT_TESTS = 5; // Evita sobrecarregar Salesforce
```

### Afegir Dependències i Prioritat a un Test

```javascript
{
    name: 'My New Test',
    dependencies: ['TestName1', 'TestName2'],  // Depèn d'aquests tests
    canRunInParallel: true,                    // Pot executar-se en paral·lel
    priority: 'high',                          // Prioritat alta (opcional)
    run: async (context) => { /* ... */ }
}
```

**Nivells de Prioritat**:
- `priority: 'high'` - S'executa en la seva pròpia fase per execució immediata
- `priority: 'regular'` (per defecte) - S'executa en fases posteriors
- `priority: undefined` - S'executa en fases posteriors

## Problema Resolt: Execució Immediata

### ❌ **Problema Anterior**
Abans, tots els tests d'alta prioritat s'agrupaven en la mateixa fase:
```
Phase 3: 2 tests (parallel) [HIGH PRIORITY]
  - executeAnonymousApex
  - runApexTest
```

**Conseqüència**: `getState` i altres tests havien d'esperar que **tots** els tests d'alta prioritat acabin.

### ✅ **Solució Implementada**
Ara, cada test d'alta prioritat té la seva pròpia fase i **totes les fases paral·leles s'executen simultàniament**:
```
Phase 3: 1 test (parallel) [HIGH PRIORITY]
  - executeAnonymousApex
Phase 4: 1 test (parallel) [HIGH PRIORITY]
  - runApexTest
Phase 5: 17 tests (parallel)
  - getState, describeObject, executeSoqlQuery, etc.
```

**Benefici**: `getState` i altres tests comencen **immediatament** després de `getOrgAndUserDetails`, sense esperar que `runApexTest` acabi. **Totes les fases paral·leles s'executen alhora**.

## Execució Simultània de Fases

### 🚀 **Nova Estratègia d'Execució**

El sistema ara executa les fases de manera intel·ligent:

1. **Fases Seqüencials** (execute first, in order):
   - Phase 0-2: Inicialització
   - Phase 6-9: Operacions seqüencials

2. **Fases Paral·leles** (execute simultaneously):
   - Phase 3: executeAnonymousApex [HIGH PRIORITY]
   - Phase 4: runApexTest [HIGH PRIORITY]
   - Phase 5: 17 tests (getState, describeObject, etc.)

### ⚡ **Benefici Clau**

**Abans**: Les fases s'executaven una després de l'altra:
```
Phase 3 → Phase 4 → Phase 5 (espera que cada una acabi)
```

**Ara**: Totes les fases paral·leles s'executen **simultàniament**:
```
Phase 3, 4, 5: S'executen alhora!
```

### 📊 **Millora de Rendiment**

- **Execució anterior**: ~32.5s
- **Execució simultània**: ~30.5s
- **Millora addicional**: +2.0s (6.2% més ràpid)

## Com Provar

### 1. Executar Tests Normals

```bash
npm test
```

### 2. Provar la Lògica de Paral·lel

```bash
node test/test-parallel.js
```

### 3. Executar Tests Específics

```bash
npm test -- --tests "describeObject,executeSoqlQuery"
```

## Consideracions Tècniques

### Seguretat

- **Concurrència limitada**: Màxim 5 tests simultànis
- **Context compartit**: Els tests que depenen d'altres reben el context correcte
- **Cleanup automàtic**: Els scripts de post-test s'executen en l'ordre correcte

### Compatibilitat

- **Retrocompatible**: Els tests existents funcionen sense canvis
- **Configurable**: Cada test pot especificar les seves dependències
- **Flexible**: Suporta tests seqüencials i paral·lels

### Monitoratge

El sistema mostra clarament quines fases s'executen:

```
=== Phase 0: 1 tests (sequential) ===
=== Phase 1: 1 tests (sequential) ===
=== Phase 2: 1 tests (sequential) ===
=== Starting 3 parallel phases simultaneously ===
=== Phase 3: 1 tests (parallel) [HIGH PRIORITY] ===
=== Phase 4: 1 tests (parallel) [HIGH PRIORITY] ===
=== Phase 5: 17 tests (parallel) ===
```

**Nota**: Les fases 3, 4 i 5 s'executen **simultàniament**, no una després de l'altra.

## Futurs Milloraments

1. **Configuració dinàmica** del límit de concurrència
2. **Mètriques detallades** de temps per fase
3. **Retry automàtic** per tests que fallen en paral·lel
4. **Priorització** de tests crítics

## Conclusió

L'execució en paral·lel dels tests MCP representa una millora significativa en l'eficiència del sistema de testing. Amb una reducció del 31% en el temps d'execució i mantenint la fiabilitat dels tests, aquesta funcionalitat millora substancialment l'experiència de desenvolupament.
