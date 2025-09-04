# Exemple d'ús de la nova eina Invoke Apex REST Resource

Aquesta nova eina permet invocar endpoints REST publicats via Apex REST Resources directament des del MCP server.

## Característiques principals

- **Detecció automàtica d'endpoints**: La eina dedueix automàticament l'URL de l'endpoint basant-se en el nom de la classe Apex
- **Autenticació automàtica**: Utilitza el token d'accés actual de l'org de Salesforce
- **Suport complet per HTTP**: GET, POST, PUT, PATCH, DELETE
- **Gestió d'errors robusta**: Proporciona missatges d'error detallats i gestió de tokens expirats

## Exemple d'ús

### Cas d'ús: Invocar un endpoint per crear una oportunitat

Suposem que tens una classe Apex REST Resource com aquesta:

```apex
@RestResource(urlMapping='/AltaOportunidad/*')
global with sharing class CSBD_WS_AltaOportunidad {

    @HttpPost
    global static CSBD_WS_AltaOportunidad_Output altaOportunidad() {
        // Lògica per crear l'oportunitat
    }
}
```

Per invocar aquest endpoint, utilitzaries la nova eina així:

```json
{
  "apexRestResource": "CSBD_WS_AltaOportunidad",
  "operation": "POST",
  "body": {
    "nombre": "Nova Oportunitat",
    "valor": 50000,
    "fechaCierre": "2024-12-31",
    "tipo": "Nova Venda"
  }
}
```

### Exemple amb paràmetres URL

Per un endpoint GET amb paràmetres:

```json
{
  "apexRestResource": "CSBD_WS_GetOportunidad",
  "operation": "GET",
  "urlParams": {
    "id": "006XXXXXXXXXXXXXXX",
    "incluirDetalls": "true"
  }
}
```

### Exemple amb headers personalitzats

```json
{
  "apexRestResource": "CSBD_WS_UpdateOportunidad",
  "operation": "PUT",
  "body": {
    "id": "006XXXXXXXXXXXXXXX",
    "valor": 75000
  },
  "headers": {
    "X-Custom-Header": "custom-value",
    "X-Request-ID": "req-12345"
  }
}
```

## Mapeig d'URLs

La eina utilitza directament el nom de la classe Apex per construir l'URL REST:

- `CSBD_WS_AltaOportunidad` → `/apexrest/CSBD_WS_AltaOportunidad`
- `WS_GetAccount` → `/apexrest/WS_GetAccount`
- `REST_UpdateContact` → `/apexrest/REST_UpdateContact`

## Resposta de l'eina

L'eina retorna una resposta estructurada que inclou:

- **Endpoint complet**: URL completa de l'endpoint
- **Detalls de la petició**: Mètode, URL, cos, paràmetres i headers
- **Resposta de Salesforce**: Resposta completa de l'API REST
- **Estat**: Èxit o error amb detalls

### Exemple de resposta d'èxit

```json
{
  "endpoint": "https://your-org.salesforce.com/apexrest/CSBD_WS_AltaOportunidad",
  "request": {
    "method": "POST",
    "url": "/apexrest/CSBD_WS_AltaOportunidad",
    "body": "{\"nombre\":\"Nova Oportunitat\",\"valor\":50000}",
    "urlParams": {},
    "headers": {}
  },
  "response": {
    "success": true,
    "id": "006XXXXXXXXXXXXXXX",
    "message": "Oportunitat creada correctament"
  },
  "status": "success",
  "success": true
}
```

## Gestió d'errors

L'eina gestiona automàticament:

- **Tokens expirats**: Renova automàticament el token d'accés
- **Errors d'autenticació**: Proporciona missatges clars sobre problemes d'autenticació
- **Errors de validació**: Mostra detalls dels errors de validació de Salesforce
- **Errors de xarxa**: Gestiona problemes de connexió

## Integració amb altres eines

Aquesta eina es pot utilitzar en combinació amb altres eines del MCP server:

- **Execute Anonymous Apex**: Per provar lògica abans de crear el REST Resource
- **DML Operations**: Per comparar resultats amb operacions DML directes
- **SOQL Queries**: Per verificar els resultats de les operacions REST

## Millors pràctiques

1. **Validació**: Sempre valida les dades abans d'enviar-les
2. **Gestió d'errors**: Implementa gestió d'errors robusta a les classes Apex
3. **Logging**: Utilitza logging per debugar problemes
4. **Seguretat**: Assegura't que les classes REST Resource tenen la seguretat adequada
5. **Documentació**: Documenta els paràmetres d'entrada i sortida dels endpoints
