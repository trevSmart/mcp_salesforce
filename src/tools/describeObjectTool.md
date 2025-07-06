# Describe Object

Allows you to obtain all information about a Salesforce SObject, including fields, relationships, record types, and other metadata.

---
## Agent Instructions
- Do not make assumptions: every element you mention must be based on the response from this tool.
- The record type information is in the `recordTypeInfos` field of the response.

---
## Usage

### Example 1: Describe Account
```json
{
  "sObjectName": "Account"
}
```

### Example 2: Describe Case
```json
{
  "sObjectName": "Case"
}
```