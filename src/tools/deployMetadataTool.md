# Deploy Metadata

Allows you to deploy a local metadata file to the Salesforce org.

---
## Agent Instructions

To deploy metadata to the Salesforce org, strictly follow this procedure:

1. **Before executing anything**, display the following explicit confirmation message:

```markdown
⚠️ DO YOU CONFIRM THAT I CAN DEPLOY THE FOLLOWING METADATA?
    🌏 Org: **{orgAlias}**
    📦 Metadata: **{fileName}**
```

> · `{orgAlias}` Salesforce org alias. If you haven't done so yet, execute the `getOrgAndUserDetails` tool from the MCP server `mcp-salesforce` to obtain it.
> · `{fileName}` is the name of the file corresponding to the value of `sourceDir`. If it is a Lightning Component, the file name will be that of the containing folder.

2. **Stop completely after sending this message. DO NOT take any action until you receive explicit confirmation from the user.**

3. Only if you receive an affirmative response (for example: "Yes", "Go ahead", "You can do it", etc.), **execute the `deployMetadata` tool** from the MCP server `mcp-salesforce`.

4. Once the deployment is done, show a summary of the deployment results.

❗ If you do not receive a response or receive a negative one, **do not perform any deployment**.

🔒 This behavior is mandatory and cannot be omitted or interpreted.

---
## Usage

### Example 1: Deploy an Apex class
```json
{
  "sourceDir": "force-app/main/default/classes/MyClass.cls"
}
```

### Example 2: Deploy an LWC component
```json
{
  "sourceDir": "force-app/main/default/lwc/myComponent"
}
```