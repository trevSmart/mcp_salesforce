# Create Metadata (Apex Class, Apex Trigger or LWC)
Generate a new Apex Class, a new Apex Trigger or a new LWC.

## Agent Instructions
- NEVER create classes, triggers or components in any other way than using this tool.
- NEVER create classes, triggers or components generating files directly.
- Use the exact fields according to the tool input schema.
- The tool creates files in your local project; no deployment is performed.
- Defaults (when `outputDir` is not provided):
  - apexClass → `force-app/main/default/classes`
  - apexTrigger → `force-app/main/default/triggers`
  - lwc → `force-app/main/default/lwc`

## Usage Examples

### Example 1: Create an Apex Class
```json
{
  "type": "apexClass",
  "name": "MyNewService"
}
```

### Example 2: Create an Apex Trigger
```json
{
  "type": "apexTrigger",
  "name": "AccountAfterInsert",
  "sobjectName": "Account",
  "events": ["afterInsert"]
}
```

### Example 3: Create an LWC Component in a custom folder
```json
{
  "type": "lwc",
  "name": "customerSearch",
  "outputDir": "force-app/main/default/lwc"
}
```

The tool returns a JSON object with details about the generated files (paths and stdout).
