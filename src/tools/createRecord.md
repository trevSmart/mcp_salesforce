{
  "name": "createRecord",
  "title": "Create Salesforce Record",
  "description": "Creates a Salesforce object record with the specified fields.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "sObjectName": {
        "type": "string",
        "description": "Salesforce object name (e.g. Account, Contact, etc.)"
      },
      "fields": {
        "type": "object",
        "description": "Object with the fields and values to create"
      }
    },
    "required": ["sObjectName", "fields"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "Salesforce record Id" },
      "url": { "type": "string", "description": "URL to the record in Salesforce" },
      "sObject": { "type": "string", "description": "SObject type" },
      "fields": { "type": "object", "description": "Fields and values used for creation" }
    },
    "required": ["id", "url", "sObject", "fields"]
  }
}
