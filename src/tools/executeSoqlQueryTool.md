# Execute SOQL Query

Allows you to execute SOQL queries in Salesforce using the CLI.

---
## Agent Instructions
- Always retrieve the Id and Name fields of the records, as well as the Name field of the related records (note that the Case object does not have a Name field; in this case, retrieve the CaseNumber field).
- Pass the SOQL query to the query parameter.
- If you want to use the Tooling API, set useToolingApi to true.
- Show the query results in table format. For every related object, show a link to the register in the Name field.

---
## Usage

- ### Example 1 `SELECT Id FROM Account`
```json
{
  "query": "SELECT Id, Name FROM Account"
}
```

- ### Example 2 `SELECT Name, AccountId, CreatedBy FROM Account`
```json
{
  "query": "SELECT Name, AccountId, Account.Name, CreatedBy, CreatedBy.Name FROM Contact"
}
```

Output:
| Id | Name | AccountId | Account.Name | CreatedBy | CreatedBy.Name |
|-----------|-----------|-----------|-----------|-----------|-----------|
| c01 | [James Doe](https://salesforceOrg.com/c01) | a01 | [Account 1](https://salesforceOrg.com/a01) | u01 | [John Doe](https://salesforceOrg.com/u01) |
| c02 | [Jane Doe](https://salesforceOrg.com/c02) | a02 | [Account 2](https://salesforceOrg.com/a02) | u02 | [Jane Doe](https://salesforceOrg.com/u02) |

- ### Example 3 (with Tooling API): `SELECT Id, Name, CreatedBy FROM ApexClass`
```json
{
  "query": "SELECT Id, Name, CreatedById, CreatedById.Name FROM ApexClass",
  "useToolingApi": true
}
```

Output:
| Id | Name | CreatedBy |
|-----------|-----------|-----------|
| 001 | [ApexClass 1](https://salesforceOrg.com/001) | [John Doe](https://salesforceOrg.com/u01) |
| 002 | [ApexClass 2](https://salesforceOrg.com/002) | [Jane Doe](https://salesforceOrg.com/u02) |