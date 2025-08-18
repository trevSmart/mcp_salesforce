# Run Apex Test

Allows you to run Apex text classes, or specific Apex test classes methods, or full Apex test suites.

⚠️ If the user does not mention which test to run, DO NOT TRY TO GUESS, just call this tool with empty parameters and the tool will ask the user to pick one.

⚠️ **IMPORTANT**: ✅ You CAN specify:
  - several classes to run
  - several tests methods to run
  - several test suites to run
  (e.g. you can run 3 test methods from different classes in the same request)

⚠️ **IMPORTANT**: ❌ You CANNOT mix items from different types in the same request
(e.g. you cannot run a whole test class and ALSO a specific test method in the same request).

---
## Agent Instructions
- **MANDATORY**: When running Apex tests in Salesforce, you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct CLI commands or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.
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

### Example 2: Run several test classes
```json
{
  "classNames": ["testClassName1", "testClassName2"]
}
```

### Example 3: Run a specific method
```json
{
  "methodNames": ["testClassName.testMethodName"]
}
```

### Example 4: Run several specific methods
```json
{
  "methodNames": ["testClass1.testMethod1", "testClass2.testMethod1", "testClass1.testMethod2"]
}
```

### Example 5: Run a test suite
```json
{
  "suiteNames": ["testSuiteName"]
}
```

### ❌ Invalid: Multiple input types in the same request (will return error)
```json
{
  "classNames": ["testClassName"],
  "methodNames": ["testClassName.testMethodName"]
}
```