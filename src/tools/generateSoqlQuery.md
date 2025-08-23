# Generate SOQL Query
Allows you to generate a well-formed, valid SOQL query instruction from a description provided by the user.

---
## Agent Instructions
- **MANDATORY**: When generating SOQL queries from descriptions, you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct CLI commands or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.
- Use the description and the list of involved fields to build the most appropriate SOQL query.
- Return the generated query as a markdown fenced block, for example:

```soql
SELECT Name, Account.Name, Account.Estado__c
FROM Contact
WHERE Account.Name = 'Acme'
```
---
## Usage
You must provide:
- the description
- the list of involved fields

### Example 1: Generate query to get active accounts
```json
{
  "soqlQueryDescription": "Get active accounts with their Id and Name",
  "involvedFields": ["Account.Id", "Account.Name", "Account.Active__c"]
}
```

### Example 2: Query with relationship
```json
{
  "soqlQueryDescription": "Get contacts created by a specific user and their account name",
  "involvedFields": ["Contact.Id", "Contact.Name", "Contact.Account.Name", "Contact.CreatedById", "Contact.CreatedBy.Name"]
}
```