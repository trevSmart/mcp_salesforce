# Run Apex Test

Allows you to run Apex text classes or specific Apex test classes methods.

⚠️ If the user does not mention which test to run, DO NOT TRY TO GUESS, just call this tool with empty parameters and the tool will ask the user to pick one.

---
## Agent Instructions
- Provide the class names if you want to run all the tests in the classes, or the method names if you want to run only specific tests. If neither is provided, the tool will ask the user to pick one.
- ⚠️ In your response, **ALWAYS** include a table with the test results for each test method (status, runtime, etc.). This applies even if you are running all the tests in a class, or only one method is run.

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