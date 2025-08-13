# DML Operation

Allows you to perform DML operations (create, update, delete) on a Salesforce record.

---
## Agent Instructions
- Use the exact fields according to the object and its definition.
  - **For single record create:**
    - provide the field values in the fields object.
  - **For single record update:**
    - provide the recordId
    - provide the field values in the fields object.
  - **For single record delete:**
    - provide the recordId
    - ⚠️ **pass and empty object (`{}`) in the fields object**.
  - **For bulk create (import):**
    - provide the filePath to the CSV file to process.
    - optional: wait, lineEnding, columnDelimiter
  - **For bulk update:**
    - provide the filePath to the CSV file to process.
    - optional: wait, lineEnding, columnDelimiter
  - **For bulk delete:**
    - provide the filePath to the CSV file (CSV with a single column named "Id").
    - optional: wait, lineEnding

- If the operation is successful, return the result of the operation (success or error).
- Always return the result of the operation (success or error).
- If the operation is not successful, return the error message.

---
## Usage

### Example 1: Create an Account
```json
{
  "operation": "create",
  "sObjectName": "Account",
  "fields": {"Name": "New Account", "Type": "Customer"}
}
```

### Example 2: Update an Account
```json
{
  "operation": "update",
  "sObjectName": "Account",
  "recordId": "001KN000006KDuKYAW",
  "fields": {"Name": "Updated Account"}
}
```

### Example 3: Delete an Account
```json
{
  "operation": "delete",
  "sObjectName": "Account",
  "recordId": "001KN000006KDuKYAW"
}
```

### Example 4: Bulk Create Contacts
```json
{
  "operation": "create",
  "sObjectName": "Contact",
  "bulk": true,
  "filePath": "/abs/path/to/contacts.csv",
  "wait": 5,
  "lineEnding": "LF",
  "columnDelimiter": "COMMA"
}
```

### Example 5: Bulk Update Accounts
```json
{
  "operation": "update",
  "sObjectName": "Account",
  "bulk": true,
  "filePath": "/abs/path/to/accounts.csv",
  "wait": 5
}
```

### Example 6: Bulk Delete Leads (hard delete)
```json
{
  "operation": "delete",
  "sObjectName": "Lead",
  "bulk": true,
  "filePath": "/abs/path/to/delete.csv",
  "wait": 10
}
```