# Apex Debug Logs

Allows you to manage Apex debug logs in Salesforce.

---
## Agent Instructions
- **MANDATORY**: When managing Apex debug logs in Salesforce, you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct CLI commands or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.
- Use only the allowed action values: "status", "on", "off", "list", "get".
- **IMPORTANT**: For the "get" action, if no logId is provided, the tool will automatically use MCP elicitation to prompt the user to select from available logs.

---
## Usage

### Log Selection Elicitation
When using the "get" action without providing a `logId`, the tool will automatically:
1. Fetch the list of available Apex debug logs (up to 50 most recent)
2. Present a user-friendly selection dialog via MCP elicitation
3. Allow the user to choose from logs with formatted information (date, duration, size)
4. Continue with the selected log retrieval

### Available Actions

- To list org's last Apex debug logs:
  - **IMPORTANT**: Only use this action when the user explicitly mentions they want to see the org's debug logs -or just asks about "apex logs" or "debug logs"-. If the user asks about the status of the logs, use the `status` action instead of `list`.
  - Use action `list`.
  - Example:
    ```json
    {
      "action": "list"
    }
    ```
  - **MANDATORY**: Show to the user the data returned for this tool action in a table with exactly these columns:
    - Date: log start date as returned by the tool
    - User: log user
    - Log type: log type
    - Size: log size as returned by the tool
    - Duration: duration as returned by the tool
    - Outcome: log status (🟢 or 🟥) and in case of 🟥, the error message
- Get a specific debug log:
  - Use action `get` and optionally pass the log id.
  - **Automatic Log Selection**: If no logId is provided, the tool will automatically:
    - Fetch available logs and present a selection dialog
    - Show logs with formatted information: `Date · Duration · Size`
    - Allow user to select from up to 50 most recent logs
  - Example with specific logId:
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
  - **MANDATORY**: Show to the user the data returned for this tool action in a table with exactly these columns, followed by a brief summary of the log content.
    - Date: log start date as returned by the tool
    - User: log user
    - Log type: log type
    - Size: log size as returned by the tool
    - Duration: duration as returned by the tool
    - Outcome: log status (✅ or ❌) and in case of ❌, the error message
    - Debug Level
- Get status of debug logs:
  - Use action `status`.
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
- Turn on debug logs:
  - Use action `on`.
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
- Turn off debug logs:
  - Use action `off`.
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

---

## Technical Implementation Details

### Elicitation System
- **Automatic Trigger**: Elicitation is automatically triggered when `logId` is missing
- **Log Formatting**: Logs are presented with human-readable information:
  - **Date**: Formatted start time of the log
  - **Duration**: Execution time in milliseconds or seconds
  - **Size**: Log file size in KB or MB
- **Selection Limit**: Maximum of 50 most recent logs are shown for selection
- **Error Handling**: If no logs are available or user cancels selection, appropriate error messages are returned

### MCP Protocol Integration
- Uses `mcpServer.server.elicitInput()` for user interaction
- Implements proper error handling for elicitation failures
- Maintains backward compatibility with existing `logId` parameter usage

### Log Processing
- Logs are fetched using `sf apex list log --json` command
- Duration and size are automatically formatted for better readability
- Only the most recent 50 logs are processed to avoid overwhelming the user