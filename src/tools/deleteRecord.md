# Delete Record

Allows you to delete a Salesforce record by its Id and object type.

---
## Agent Instructions
- Always provide the recordId and sObjectName.
- Return the result of the deletion (success or error).

---
## Usage

### Example 1: Delete an Account
```json
{
  "sObjectName": "Account",
  "recordId": "001KN000006KDuKYAW"
}
```

### Example 2: Delete a Contact
```json
{
  "sObjectName": "Contact",
  "recordId": "003KN00000abcdeYAW"
}
```

{
  "name": "deleteRecord",
  "title": "Delete Salesforce Record",
  "description": "Deletes a Salesforce object record by its Id.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "sObjectName": {
        "type": "string",
        "description": "Salesforce object name (e.g. Account, Contact, etc.)"
      },
      "recordId": {
        "type": "string",
        "description": "Id of the record to delete"
      }
    },
    "required": ["sObjectName", "recordId"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "Salesforce record Id" },
      "sObject": { "type": "string", "description": "SObject type" },
      "status": { "type": "string", "description": "Status message of the delete operation" }
    },
    "required": ["id", "sObject", "status"]
  }
}