# DML Operation

Allows you to perform DML operations (create, update, delete) on a Salesforce record.

---
## Agent Instructions
- Use the exact fields according to the object and its definition.
- For update and delete, remember to provide the recordId.
- For create and update, provide the field values in the fields object.
- Always return the result of the operation (success or error).

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