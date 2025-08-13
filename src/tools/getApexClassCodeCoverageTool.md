# Get Apex Classes Code Coverage

Retrieves the code coverage information for a specific Apex classes using the Tooling API.

---

## Agent Instructions

-   Always pass the exact class names (case sensitive).
-   The result contains the number of covered and uncovered lines and the calculated percentage when available.

---

## Usage

### Example 1: Get coverage for two classes

```json
  "classNames": ["MyClass", "MyClass2"]
}
```

### Output

```json
{
  "success": true,
  "classes": [
    {
      "className": "MyClass",
      "classId": "01p...",
      "numLinesCovered": 120,
      "numLinesUncovered": 30,
      "percentage": 80
      "testMethods": [
        {
          "className": "MyClassTest",
          "methodName": "testMethod1",
          "numLinesCovered": 120,
          "numLinesUncovered": 30,
          "percentage": 80
        }
      ]
    }
    {
      "className": "MyClass2",
      "classId": "01p...",
      "numLinesCovered": 120,
      "numLinesUncovered": 30,
      "percentage": 80
      "testMethods": [
        {
          "className": "MyClass2Test",
          "methodName": "testMethod2",
          "numLinesCovered": 120,
          "numLinesUncovered": 30,
          "percentage": 80
        }
      ]
    }
    ]
}
```

If the class has no recorded coverage data, the tool returns:

```json
{
	"success": true,
	"classes": [
		{
			"className": "MyClass",
			"classId": "01p...",
			"numLinesCovered": 0,
			"numLinesUncovered": 0,
			"percentage": 0,
			"testMethods": []
		}
	]
}
```
