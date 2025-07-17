# Apex Debug Logs

Allows you to manage Apex debug logs in Salesforce.

---
## Agent Instructions
- Use only the allowed action values: "status", "on", "off", "list", "get".
- Show the result of the action (success, error, or list of logs).

---
## Usage

### Example 1: Get status of debug logs
```json
{
  "action": "status"
}
```

### Example 2: Turn on debug logs
```json
{
  "action": "on"
}
```

### Example 3: Turn off debug logs
```json
{
  "action": "off"
}
```

### Example 4: Get list of logs
```json
{
  "action": "list"
}
```

### Example 5: Get a specific log
```json
{
  "action": "get",
  "logId": "000000000000000"
}
```