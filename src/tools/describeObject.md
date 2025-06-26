# Describe Object

Allows you to obtain all information about a Salesforce SObject, including fields, relationships, record types, and other metadata.

---
## Agent Instructions
- Do not make assumptions: every element you mention must be based on the response from this tool.
- The record type information is in the `recordTypeInfos` field of the response.
- If the field does not exist, return a clear message.

---
## Usage

### Example 1: Describe Account
```json
{
  "sObjectName": "Account"
}
```

### Example 2: Describe Case
```json
{
  "sObjectName": "Case"
}
```

{
  "name": "describeObject",
  "title": "Describe Salesforce Object",
  "description": "Gets the description of a Salesforce SObject, including fields, relationships, and record types.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "sObjectName": {
        "type": "string",
        "description": "Salesforce object name (e.g. Account, Contact, etc.)"
      }
    },
    "required": ["sObjectName"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "API name of the object" },
      "label": { "type": "string", "description": "Label of the object" },
      "fields": {
        "type": "array",
        "description": "List of fields of the object",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "label": { "type": "string" },
            "type": { "type": "string" },
            "referenceTo": { "type": "array", "items": { "type": "string" } },
            "relationshipName": { "type": ["string", "null"] }
          },
          "required": ["name", "label", "type"]
        }
      },
      "recordTypeInfos": {
        "type": "array",
        "description": "List of available record types",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "label": { "type": "string" },
            "available": { "type": "boolean" }
          },
          "required": ["name", "label", "available"]
        }
      }
    },
    "required": ["name", "label", "fields", "recordTypeInfos"]
  }
}