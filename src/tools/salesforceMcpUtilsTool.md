# Salesforce MCP Utils Tool

Allows you to execute utility actions on the Salesforce MCP server.

---
## Agent Instructions
- Use only the allowed action values:
  - "clearCache":
    - Clears the cache of the Salesforce MCP server
  - "getCurrentDatetime":
    - Returns the current date and time
  - "getState":
    - Returns the internal state of the Salesforce MCP server

- Always return the result of the action.

---
## Usage

### Example 1: Clear the cache
```json
{
  "action": "clearCache"
}
```
### Example 2: Get the current date and time
```json
{
  "action": "getCurrentDatetime"
}
```
### Example 3: Get the internal state of the Salesforce MCP server
```json
{
  "action": "getState"
}
```