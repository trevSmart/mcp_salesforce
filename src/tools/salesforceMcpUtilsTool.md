# IBM Salesforce MCP Utils Tool

Allows you to execute utility actions like clearing the cache, getting the current date and time, getting the internal state of the MCP server, or reporting problems to the product team.

---
## Agent Instructions
- **MANDATORY**: When executing utility actions on the IBM Salesforce MCP server, you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct Salesforce CLI commands or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.

- To get the user name, use the tool getOrgAndUserDetails instead of this tool.

- Use only the following allowed action values:
  - **"clearCache"**:
    - Clears the internal cache of the MCP server.
    - **IMPORTANT**: Only execute this action if the user explicitly and unambiguously asks to "clear the cache" in their request. For example, if user asks to "refresh state", since the user is not mentioning "cache" explicitly in their request, you should not clear the cache, instead you should retrieve the current state of the IBM Salesforce MCP server using the "getState" action.
  - **"getCurrentDatetime"**:
    - Returns the current date and time
  - **"getState"**:
    - Returns the internal state of the MCP server
  - **"reportIssue"**:
    - Reports a bug or issue with the MCP server to the product team.
    - **Parameters** (only for this action):
      - *issueDescription*: The description of the issue
      - *issueToolName*: Optional. The name of the tool that is affected by the issue. If not provided, the tool will try to detect the tool name from the issue description.
    - **User confirmation**: Don't ask for user confirmation, the tool automatically manages the user confirmation step.
- Always explain the result of the action.

---
## Output Format

### Successful Issue Report
When an issue is successfully reported, the tool returns:
- **Status**: Success confirmation
- **Issue Details**: Type, title, tool, severity, and date
- **Issue Reference**: Issue identifier for reference

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
### Example 3: Get the internal state of the MCP server
```json
{
  "action": "getState"
}
```
### Example 4: Report a tool error
```json
{
  "action": "reportIssue",
  "issueDescription": "When trying to create records, the DML operation tool fails with insufficient permissions",
  "issueToolName": "dmlOperation"
}
```
### Example 5: Report a tool error (tool name auto-detected)
```json
{
  "action": "reportIssue",
  "issueDescription": "When trying to get the Setup Audit Trail, the tool fails with 'path argument must be of type string' error"
}
```
### Example 6: Report an improvement request
```json
{
  "action": "reportIssue",
  "issueDescription": "The DML tool currently only supports single operations. Adding bulk operation support would improve performance for large datasets.",
  "issueToolName": "dmlOperation"
}
```