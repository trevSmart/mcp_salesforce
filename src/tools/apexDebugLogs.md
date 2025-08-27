# Apex Debug Logs Tool

Allows you to manage Apex debug logs in Salesforce.

---
## Agent Instructions
- **MANDATORY**: When managing Apex debug logs in Salesforce, you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct CLI commands or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.
- Use only the allowed action values: "status", "on", "off", "list", "get" or "analyze".

---
## Usage

### Available Actions

- `action: 'list'`: To list org's last Apex debug logs:

  - **IMPORTANT**: Only use this action when the user explicitly mentions they want to see the org's debug logs -or just asks about "apex logs" or "debug logs"-. If the user asks about **the status** of the logs, use the `action: 'status'` action instead.
  - Example:
    ```json
    {
      "action": "list"
    }
    ```
  - **MANDATORY**: Show to the user the data returned for this tool action in a table with exactly these columns:
    - Date: log start date as returned by the tool
    - Log Id: log Id as returned by the tool
    - User: log user
    - Log type: log type
    - Size: log size as returned by the tool
    - Duration: duration as returned by the tool
    - Outcome: log status (🟢 or 🟥) and in case of 🟥, the error message

- `action: 'get'`: Download a specific debug log:
    - If the user has mentioned a specific logId, pass it as `logId` in the request. Otherwise, the tool will automatically show a selection menu to the user to select from the available logs.

  - Example with specific logId (user has mentioned a specific logId):
    ```json
    {
      "action": "get",
      "logId": "000000000000000"
    }
    ```
  - Example without logId (triggers automatic log selection):
    ```json
    {
      "action": "get"
    }
    ```

- `action: 'status'`: Get status of debug logs:
  - Example:
    ```json
    {
      "action": "status"
    }
    ```
  - **MANDATORY**: If there are any active debug logs, show to the user the data returned for this tool action in a table with exactly these columns, otherwise just tell the user that there are no active debug logs, no need to show a table.
    - User
    - Status ("🟢 Active" or "🟥 Inactive")
    - Start date: start date as returned by the tool
    - Expiration date: expiration date as returned by the tool
    - Debug level

- `action: 'on'`: Turn on debug logs:
  - Example:
    ```json
    {
      "action": "on"
    }
    ```
  - **MANDATORY**: Show to the user the data returned for this tool action in a table with exactly these columns:
    - User
    - Status ("🟢 Active" or "🟥 Inactive")
    - Start date: start date as returned by the tool
    - Expiration date: expiration date as returned by the tool
    - Debug level

- `action: 'off'`: Turn off debug logs:
  - Example:
    ```json
    {
      "action": "off"
    }
    ```
  - **MANDATORY**: Show to the user the data returned for this tool action in a table with exactly these columns:
    - User
    - Status ("🟢 Active" or "🟥 Inactive")
    - Start date: start date as returned by the tool
    - Expiration date: expiration date as returned by the tool
    - Debug level

- `action: 'analyze'`: Analyze debug logs:
  - **IMPORTANT**: For the "analyze" action, if no logId is provided, the tool will automatically show a selection menu to the user to select from the available logs.
  - Parameters:
    - **`logId`**: The ID of the log to analyze (optional for "analyze" action - if not provided, user will be prompted to select from available logs)
    - **`analyzeOptions`**: Object with options for the analyze action (only used when action is "analyze")
      - **`analyzeOptions.minDurationMs`**: Filter out events shorter than this duration in milliseconds (default: 0)
      - **`analyzeOptions.maxEvents`**: Trim to the first N completed events after filtering (default: 200)
      - **`analyzeOptions.output`**: Which artifacts to return in the tool output. Options: "both", "json", "diagram" (default: "both")

  - Example with specific logId (user has mentioned a specific logId):
    ```json
    {
      "action": "analyze",
      "logId": "000000000000000"
    }
    ```
  - Example without logId (triggers automatic log selection):
    ```json
    {
      "action": "analyze"
    }
    ```
  - Example with custom analyze options:
    ```json
    {
      "action": "analyze",
      "logId": "000000000000000",
      "analyzeOptions": {
        "minDurationMs": 1000,
        "maxEvents": 100,
        "output": "both"
      }
    }
    ```
---
## Examples

### Basic Usage
```json
{
  "action": "status"
}
```

### Get Specific Log
```json
{
  "action": "get",
  "logId": "000000000000000"
}
```

### Analyze with Default Options
```json
{
  "action": "analyze",
  "logId": "000000000000000"
}
```

### Analyze with Custom Options
```json
{
  "action": "analyze",
  "logId": "000000000000000",
  "analyzeOptions": {
    "minDurationMs": 5000,
    "maxEvents": 50,
    "output": "diagram"
  }
}
```

### List All Available Logs
```json
{
  "action": "list"
}
```

### Turn On Debug Logs
```json
{
  "action": "on"
}
```

### Turn Off Debug Logs
```json
{
  "action": "off"
}
```