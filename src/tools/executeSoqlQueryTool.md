# Execute SOQL Query

Allows you to execute SOQL queries in Salesforce using the CLI.

---
## Agent Instructions
- Pass the SOQL query to the query parameter.
- If you want to use the Tooling API, set useToolingApi to true.
- Show the query results in table format.

---
## Usage

### Example 1: Basic query
```json
{
  "query": "SELECT Id, Name FROM Account"
}
```

### Example 2: Query with Tooling API
```json
{
  "query": "SELECT Id, Name FROM ApexClass",
  "useToolingApi": true
}
```

{
  "name": "executeSoqlQuery",
  "title": "Execute SOQL Query",
  "description": "Executes a SOQL query in Salesforce using the CLI.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "SOQL query to execute"
      },
      "useToolingApi": {
        "type": "boolean",
        "description": "If true, use Tooling API"
      }
    },
    "required": ["query"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "records": {
        "type": "array",
        "description": "List of records returned by the query",
        "items": { "type": "object" }
      }
    },
    "required": ["records"]
  }
}