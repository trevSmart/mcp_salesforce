# Run Apex Test

Allows you to run an Apex test class (and optionally a specific method) in Salesforce.

---
## Agent Instructions
- Always provide the class name, and the method if you want to run only a specific test.
- Show the test result (success, error, coverage, etc.).

---
## Usage

### Example 1: Run a test class
```json
{
  "classNames": ["MyTestClasses"]
}
```

### Example 2: Run a specific method
```json
{
  "classNames": ["MyTestClasses"],
  "methodNames": ["testInsertAccount"]
}
```