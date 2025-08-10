# Generate SOQL Query

Allows you to generate a SOQL query from a description and a list of involved objects.

---
## Agent Instructions
- Use the description and the list of objects to build the most appropriate SOQL query.
- Return the generated query as text.

---
## Usage

### Example 1: Generate query to get active accounts
```json
{
  "soqlQueryDescription": "Get active accounts with their Id and Name",
  "involvedSObjects": ["Account"]
}
```

### Example 2: Query with relationship
```json
{
  "soqlQueryDescription": "Get contacts and their account name",
  "involvedSObjects": ["Contact", "Account"]
}
```