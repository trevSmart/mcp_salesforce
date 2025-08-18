# Describe Object

Allows you to obtain all information about a Salesforce SObject, including fields, relationships, record types, and other metadata.

---
## Agent Instructions
- **MANDATORY**: When obtaining Salesforce SObject information (fields, relationships, record types, metadata), you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct CLI commands, SOQL queries, or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.
- Use the 'include' parameter to filter the information you need: 'fields' for field information only, 'record types' for record types only, 'child relationships' for relationships only, or 'all' for complete information.
- **CRITICAL**: Call this tool ONLY ONCE per SObject. The response contains ALL the information you need about the SObject. DO NOT call this tool multiple times for the same SObject unless the user explicitly requests different information with a different 'include' parameter.
- **IMPORTANT**: The response provides comprehensive information. If the user asked for specific details (e.g., "What fields does Case have for status tracking?"), read the response to locate the relevant information. Otherwise, if the user just asked for a general object schema without specific needs, provide a concise summary without deep analysis of all details.
- Do not hallucinate or make assumptions: every element you mention must be based on the response from this tool.
- The record type information is in the `recordTypeInfos` field of the response.

---
## Usage

### Example 1: Describe Account with all information
```json
{
  "sObjectName": "Account",
  "include": "all"
}
```

### Example 2: Describe Case with only the fields information
```json
{
  "sObjectName": "Case",
  "include": "fields"
}
```