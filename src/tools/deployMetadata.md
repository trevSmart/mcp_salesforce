# Deploy Metadata

Allows you to deploy a local metadata file to the Salesforce org.

---
## Agent Instructions
- Before deploying, show a confirmation message to the user with the org alias and the file name.
- Only execute the deploy if you receive explicit confirmation.
- Show a summary of the deploy result.

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