# Apex Debug Logs

Allows you to manage Apex debug logs in Salesforce.

---
## Agent Instructions
- Use only the allowed action values: "start", "stop", "get".
- Show the result of the action (success, error, or list of logs).

---
## Usage

### Example 1: Start debug logs
```json
{
  "action": "start"
}
```

### Example 2: Stop debug logs
```json
{
  "action": "stop"
}
```

### Example 3: Get list of logs
```json
{
  "action": "get"
}
```