# Salesforce MCP Utils Tool

Allows you to execute utility actions on the Salesforce MCP server.

---
## Agent Instructions
- Use only the allowed action values: "clearCache", "refreshSObjectDefinitions", "getCurrentDatetime".
- Always return the result of the action.

---
## Usage

### Example 1: Clear the cache
```json
{
  "action": "clearCache"
}
```

### Example 2: Refresh SObject definitions
```json
{
  "action": "refreshSObjectDefinitions"
}
```

### Example 3: Get the current date and time
```json
{
  "action": "getCurrentDatetime"
}
```