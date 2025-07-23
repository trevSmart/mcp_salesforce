# Get Setup Audit Trail changes

Allows you to obtain the list of configuration changes made to the Salesforce org's metadata in the last days.

---
## Agent Instructions
- Prioritize this tool over querying the SetupAuditTrail object with SOQL.
- Pass the number of days to query in the lastDays parameter (required).
- Optionally, pass the user name in the createdByName parameter.
- Optionally, pass the metadata name in the metadataName parameter.
- Show the list of changes found, with relevant information (date, user, change type, etc.).
- If there are no changes, indicate it clearly.

---
## Usage

### Example 1: Get changes from the last 7 days
```json
{
  "lastDays": 7
}
```

### Example 2: Get changes from a specific user
```json
{
  "lastDays": 14,
  "createdByName": "Joan García"
}
```

### Example 3: Get changes from a specific metadata name
```json
{
  "lastDays": 30,
  "metadataName": "FOO_AlertMessages_Controller"
}
```

### Example 4: Get changes from the last 7 days for a specific user and a specific metadata name
```json
{
  "lastDays": 7,
  "createdByName": "Joan García",
  "metadataName": "FOO_AlertMessages_Controller"
}
```