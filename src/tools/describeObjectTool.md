# Describe Object

Allows you to obtain SObject schema information.

---

## Agent Instructions

- **MANDATORY**: When obtaining Salesforce SObject information (fields, relationships, record types, metadata), you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct CLI commands, SOQL queries, or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.
- Use the `excludeFields` boolean parameter to control whether fields are included in the response.
- **CRITICAL**: Call this tool ONLY ONCE per SObject. The response contains ALL the information you need about the SObject. DO NOT call this tool multiple times for the same SObject unless the user explicitly requests different information with a different `excludeFields` parameter.
- **IMPORTANT**: The response provides comprehensive information. If the user asked for specific details (e.g., "What fields does Case have for status tracking?"), read the response to locate the relevant information. Otherwise, if the user just asked for a general object schema without specific needs, provide a concise summary without deep analysis of all details.
- Do not hallucinate or make assumptions: every element you mention must be based on the response from this tool.
- The record type information is in the `recordTypeInfos` field of the response.

---

## Usage

### Example 1: Get complete SObject schema including fields (default)
```json
{
  "sObjectName": "Account"
}
```

### Example 2: Get only metadata (no fields) for faster processing
```json
{
  "sObjectName": "Account",
  "excludeFields": true
}
```

### Example 3: Get metadata for Case object
```json
{
  "sObjectName": "Case",
  "excludeFields": true
}
```
### Considerations:
- **New implementation**: This is a pilot version for testing and comparison
- **Field mapping**: Some field properties may be mapped differently from traditional describe
- **Picklist values**: Requires separate UI API calls for detailed picklist information
- **Boolean simplicity**: Focused on real-world use cases rather than granular control

## Response Format

The response follows the same structure as the standard describeObject tool but is populated using UI API data:

```json
{
  "name": "Account",
  "label": "Account",
  "fields": [...], // Only included when excludeFields is false
  "recordTypeInfos": [...],
  "childRelationships": [...]
}
```

**Note**: The default behavior (`excludeFields: false`) is recommended for most use cases where you need field details. Set `excludeFields: true` only when you specifically want to exclude fields for better performance.
