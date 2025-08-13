# Get Apex Class Code Coverage

Retrieves the code coverage information for a specific Apex class using the Tooling API.

---
## Agent Instructions
- Always pass the exact class name (case sensitive).
- The result contains the number of covered and uncovered lines and the calculated percentage when available.

---
## Usage

### Example 1: Get coverage for a class
```json
{
  "className": "MyClass"
}
```

### Output
```json
{
  "success": true,
  "className": "MyClass",
  "classId": "01p...",
  "numLinesCovered": 120,
  "numLinesUncovered": 30,
  "percentage": 80
}
```

If the class has no recorded coverage data, the tool returns:
```json
{
  "success": false,
  "className": "MyClass"
}
```


