# Execute Anonymous Apex

Allows you to execute anonymous Apex code in Salesforce.

---
## Agent Instructions
- Always show the code to be executed before running it.
- If the code modifies data, wait for explicit user confirmation before executing.
- Always do a System.debug() of the value returned by the function.
- Show a summary of the result of the anonymous apex script execution.

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