# Get Record Tool

Allows you to obtain a Salesforce record by its Id and object type.

---
## Agent Instructions
- **MANDATORY**: When retrieving Salesforce records, you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct CLI commands, SOQL queries, or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.
- Do not return any field that is not explicitly in the response.
- If the field is a lookup, show the link to the related record.
- If the record does not exist, return a clear message indicating so.

---
## Usage

### Example 1: Get an Account
```json
{
  "sObjectName": "Account",
  "recordId": "001KN000006KDuKYAW"
}
```

### Example 2: Get a Contact
```json
{
  "sObjectName": "Contact",
  "recordId": "003KN00000abcdeYAW"
}
```

{
  "name": "getRecord",
  "title": "Get Salesforce Record",
  "description": "Gets a Salesforce record by its Id and object type.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "sObjectName": {
        "type": "string",
        "description": "Salesforce object name (e.g. Account, Contact, etc.)"
      },
      "recordId": {
        "type": "string",
        "description": "Id of the record to retrieve"
      }
    },
    "required": ["sObjectName", "recordId"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "Salesforce record Id" },
      "sObject": { "type": "string", "description": "SObject type" },
      "fields": { "type": "object", "description": "Object with all the fields and values of the record" }
    },
    "required": ["id", "sObject", "fields"]
  }
}