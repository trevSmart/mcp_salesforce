# Get Setup Audit Trail

Allows you to obtain the list of configuration changes made to the Salesforce org's metadata in recent days.

---
## Agent Instructions
- Pass the number of days (lastDays) and the user name (createdByName) if filtering is needed.
- Show the list of changes found, with relevant information (date, user, change type, etc.).
- If there are no changes, indicate it clearly.

---
## Usage

### Example 1: Get changes from the last 7 days
```json
{
  "lastDays": 7,
  "createdByName": null
}
```

### Example 2: Get changes from a specific user
```json
{
  "lastDays": 30,
  "createdByName": "Joan Garcia"
}
```