# Execute Anonymous Apex

Allows you to execute anonymous Apex code in Salesforce.

---
## Agent Instructions

- ⚠️ Prioritize the use of specific tools before executing Apex code.

  > **Example**
  > If you want to create a record, use the `createRecord` tool from the MCP server `mcp-salesforce`.
  > If you want to delete a record, use the `deleteRecord` tool from the MCP server `mcp-salesforce`.
  > If you want to update a record, use the `updateRecord` tool from the MCP server `mcp-salesforce`.

- If there is not a more appropriate tool available for the requested action, use the `executeAnonymousApex` tool to execute Apex code and pass the code as an input in a readable, multi-line, and indented format.
- Always do a System.debug() of the value returned by the function. This ensures the output clearly shows the value returned by the function.
- Show a summary of the result of the anonymous apex script execution.
- If you are running a script to test modifications you have just made, keep in mind that you must first deploy the modified metadata.

- ⚠️ **IMPORTANT: If the code could potentially modify data, ALWAYS show the code BEFORE executing it, following the procedure below.**
  1. **FIRST**: Show the code you want to execute in an Apex code block
    ```apex
    //SCRIPT TO EXECUTE:

    {script}
    ```
  2. **THEN**: Wait for user confirmation if necessary:
    - If the anonymous Apex **does not modify data** in the Salesforce org, execute the code directly after showing it.
    - If the anonymous Apex **modifies data** in the Salesforce org, after showing the code, follow the procedure below.

  3. **FINALLY**: Execute the code with the tool

### Cases that require explicit confirmation

If the anonymous Apex **does not modify data** in the Salesforce org, execute the code directly after showing it.

If the anonymous Apex **modifies data** in the Salesforce org, after showing the code, follow this procedure:

1. Show the following explicit confirmation message:

```markdown
⚠️ DO YOU CONFIRM THAT I CAN EXECUTE THIS APEX SCRIPT?
🌏 Org: **{orgAlias}**
```
> · `{orgAlias}` Salesforce org alias. If you haven't done so yet, execute the `getOrgAlias` tool from the MCP server `mcp-salesforce` to obtain it (do this without giving details so the action is as transparent as possible)

2. **Stop completely after sending this message. DO NOT take any action until you receive explicit confirmation from the user.**

3. Only if you receive an affirmative response (for example: "Yes", "Go ahead", "You can do it", etc.), **execute the tool**

4. Once the script has been executed, show a summary of the execution results.

❗ If you do not receive a response or receive a negative one, **do not execute the script**.

🔒 This behavior is mandatory and cannot be omitted or interpreted.



---
## Usage

### Example 1: Execute a simple debug
```json
{
  "apexCode": "System.debug('Hello World!');"
}
```

### Example 2: Execute a class function
```json
{
  "apexCode": "MyClass.myMethod();"
}
```