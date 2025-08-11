# Run Apex Test

Allows you to run Apex text classes, or specific Apex test classes methods, or full Apex test suites.

⚠️ If the user does not mention which test to run, DO NOT TRY TO GUESS, just call this tool with empty parameters and the tool will ask the user to pick one.

---
## Agent Instructions
- Provide the class names if you want to run all the tests in the classes, or the method names if you want to run only specific tests, or the suite names if you want to run all the tests in a test suite. If neither is provided, the tool will ask the user to pick one.

- ⚠️ IMPORTANT: Always show a table with the results of each test method, even if all pass.
  - The table must include: Class, Method, Status, Execution Time (ms).
  - Do not show only text, the table is mandatory.
  - If you do not follow this format, the response is considered incorrect.

---
## Usage

### Example 1: Run a test class
```json
{
  "classNames": ["testClassName"]
}
```

### Example 2: Run a specific method
```json
{
  "methodNames": ["testClassName.testMethodName"]
}
```

### Example 3: Run a test suite
```json
{
  "suiteNames": ["testSuiteName"]
}
```