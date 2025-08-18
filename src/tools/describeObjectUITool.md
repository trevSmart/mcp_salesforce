# Describe Object (UI API)

Allows you to obtain SObject schema information using Salesforce's UI API for better performance compared to the traditional Describe Object operation.

---

## Agent Instructions

- **MANDATORY**: When obtaining Salesforce SObject information using UI API (fields, relationships, record types, metadata), you MUST use this tool exclusively for testing and comparison purposes. This is an alternative implementation to the standard describeObject tool that uses UI API for better performance.
- Use the 'include' parameter to filter the information you need: 'fields' for field information only, 'record types' for record types only, 'child relationships' for relationships only, or 'all' for complete information.

---

## Usage

### Example 1: Describe Account with all information using UI API
```json
{
  "sObjectName": "Account",
  "include": "all"
}
```

### Example 2: Describe Case with only the fields information using UI API
```json
{
  "sObjectName": "Case",
  "include": "fields"
}
```

### Example 3: Get only record types for Opportunity
```json
{
  "sObjectName": "Opportunity",
  "include": "record types"
}
```

## Key Differences from Standard Describe Object

### Advantages:
- **Faster performance**: Uses UI API which is optimized for speed
- **Real-time updates**: Reflects metadata changes immediately
- **Security integrated**: Automatically respects field-level security
- **Modern API**: Uses Salesforce's recommended UI API

### Considerations:
- **New implementation**: This is a pilot version for testing and comparison
- **Field mapping**: Some field properties may be mapped differently from traditional describe
- **Picklist values**: Requires separate UI API calls for detailed picklist information

## Response Format

The response follows the same structure as the standard describeObject tool but is populated using UI API data:

```json
{
  "name": "Account",
  "label": "Account",
  "fields": [...],
  "recordTypeInfos": [...],
  "childRelationships": [...]
}
```
