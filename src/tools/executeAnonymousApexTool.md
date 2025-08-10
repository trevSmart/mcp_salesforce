# Execute Anonymous Apex

Allows you to execute anonymous Apex code in Salesforce.

---
## Agent Instructions
- ⚠️ Prioritize the use of specific tools before executing Apex code:
  - Example
    > If you want to create a record, use the `createRecord` tool from the MCP server `mcp-salesforce`.
    > If you want to delete a record, use the `deleteRecord` tool from the MCP server `mcp-salesforce`.
    > If you want to update a record, use the `updateRecord` tool from the MCP server `mcp-salesforce`.

  - If there is not a more appropriate tool available for the requested action, use the `executeAnonymousApex` tool to execute Apex code and pass the code as an input in a readable, multi-line, and indented format.

- Always show the code before executing it, but execute it right away. ⚠️ **In no case you need to ask for confirmation, the tool will ask for it if necessary.**
- Always do a System.debug() of the value returned by the function. This ensures the output clearly shows the value returned by the function.
- Show a summary of the result of the anonymous apex script execution.
- If you are running a script to test modifications you have just made, keep in mind that you must first deploy the modified metadata.

---
## Usage

### Example 1: Execute a simple debug
```json
{
  "apexCode": "System.debug('Hello World!');",
  "mayModify": false
}
```

### Example 2: Execute a class function
```json
{
  "apexCode": "MyClass.myMethod();",
  "mayModify": true
}
```