# Describe Object (UI API)

Allows you to obtain SObject schema information using Salesforce's UI API for better performance compared to the traditional Describe Object operation.

---

## Agent Instructions

- **MANDATORY**: When obtaining Salesforce SObject information using UI API (fields, relationships, record types, metadata), you MUST use this tool exclusively for testing and comparison purposes. This is an alternative implementation to the standard describeObject tool that uses UI API for better performance.
- Use the `excludeFields` boolean parameter to control whether fields are included in the response.
- **IMPORTANT**: The `excludeFields` parameter has NO performance impact on the API call since the UI API always returns all data in a single HTTP call. However, excluding fields significantly reduces response size and processing time.
- **CRITICAL**: Call this tool ONLY ONCE per SObject. The response contains ALL the information you need about the SObject. DO NOT call this tool multiple times for the same SObject unless the user explicitly requests different information with a different `excludeFields` parameter.
- **IMPORTANT**: The response provides comprehensive information. If the user asked for specific details (e.g., "What fields does Case have for status tracking?"), read the response to locate the relevant information. Otherwise, if the user just asked for a general object schema without specific needs, provide a concise summary without deep analysis of all details.
- Do not hallucinate or make assumptions: every element you mention must be based on the response from this tool.
- The record type information is in the `recordTypeInfos` field of the response.

---

## Performance Characteristics

### Why This Approach Makes Sense

The UI API always returns the complete SObject schema in a single HTTP call, but the **fields** are by far the heaviest part of the response:

- **Fields**: Can be hundreds of fields, each with detailed metadata (types, validation rules, picklist values, etc.)
- **Record Types**: Usually just a few dozen with basic info
- **Child Relationships**: Usually just a handful with basic info

### Simple Boolean Control

- **`excludeFields: false`** (default): Complete information including fields (heavy response, slower processing)
- **`excludeFields: true`**: Basic info + record types + relationships, NO fields (light response, fast processing)

### Performance Impact

- **API Call Time**: Always the same (UI API returns all data)
- **Response Size**: Significantly smaller without fields
- **Processing Time**: Much faster without fields
- **User Experience**: Better performance for metadata-only needs

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

## Key Differences from Standard Describe Object

### Advantages:
- **Faster performance**: Uses UI API which is optimized for speed
- **Real-time updates**: Reflects metadata changes immediately
- **Security integrated**: Automatically respects field-level security
- **Modern API**: Uses Salesforce's recommended UI API
- **Simple control**: Single boolean parameter for practical use cases

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

## When to Use Each Option

### Use `excludeFields: false` (default) when:
- You need complete field information
- Building field-level functionality
- Detailed schema analysis
- Development and debugging

### Use `excludeFields: true` when:
- You only need basic object information
- Working with record types or relationships
- Quick object validation
- Performance is critical
- Fields are not needed

**Note**: The default behavior (`excludeFields: false`) is recommended for most use cases where you need field details. Set `excludeFields: true` only when you specifically want to exclude fields for better performance.
