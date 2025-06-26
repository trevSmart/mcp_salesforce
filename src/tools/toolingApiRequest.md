# Tooling API Request

Allows you to make a request to the Salesforce Tooling API.

---
## Agent Instructions
- Pass the HTTP method and the corresponding endpoint.
- Show the result of the request (success, error, returned data).

---
## Usage

### Example 1: Query ApexClass
```json
{
  "method": "GET",
  "endpoint": "/tooling/query/?q=SELECT+Name+FROM+ApexClass+LIMIT+10"
}
```

### Example 2: Create a Tooling record
```json
{
  "method": "POST",
  "endpoint": "/tooling/sobject/ApexClass/",
  "body": {"Name": "TestClass", "Body": "public class TestClass {}"}
}
```