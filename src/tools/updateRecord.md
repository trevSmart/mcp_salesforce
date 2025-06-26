# updateRecord

Permet actualitzar un registre d'un objecte de Salesforce passant l'Id i els camps a modificar.

---
## Paràmetres

- `sObjectName` (string): Nom de l'objecte Salesforce (ex: Account, Contact, etc.)
- `recordId` (string): Id del registre a actualitzar
- `fields` (objecte o string JSON): Objecte amb els camps i valors a modificar

---
## Exemple d'ús

```js
{
  sObjectName: "Account",
  recordId: "001KN000006KDuKYAW",
  fields: { Name: "Compte Actualitzat", Type: "Customer" }
}
```

---
## Resultat

Retorna un objecte amb informació de l'actualització o un error si falla.

{
  "name": "updateRecord",
  "title": "Update Salesforce Record",
  "description": "Actualitza un registre d'un objecte de Salesforce passant l'Id i els camps a modificar.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "sObjectName": {
        "type": "string",
        "description": "Nom de l'objecte Salesforce (ex: Account, Contact, etc.)"
      },
      "recordId": {
        "type": "string",
        "description": "Id del registre a actualitzar"
      },
      "fields": {
        "type": "object",
        "description": "Objecte amb els camps i valors a modificar"
      }
    },
    "required": ["sObjectName", "recordId", "fields"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "Salesforce record Id" },
      "sObject": { "type": "string", "description": "SObject type" },
      "fields": { "type": "object", "description": "Fields and values updated" },
      "status": { "type": "string", "description": "Status message of the update operation" }
    },
    "required": ["id", "sObject", "fields", "status"]
  }
}