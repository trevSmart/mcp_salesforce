# Deploy Metadata

Allows you to deploy a local metadata file to the Salesforce org.

---
## Agent Instructions

> · `{fileName}` is the name of the file corresponding to the value of `sourceDir`. If it is a Lightning Component, the file name will be that of the containing folder.

2. **Then**, execute the `deployMetadata` tool.

3. Once the deployment is done, show a summary of the deployment results.

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