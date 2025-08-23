# Get Recently Viewed Records Tool

Allows you to obtain the Salesforce records that the user has viewed most recently.

---
## Agent Instructions
- **MANDATORY**: When obtaining recently viewed Salesforce records, you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct CLI commands, SOQL queries, or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.
- Show each record as a markdown link to its detail URL.
- If the list is empty, indicate it clearly.
- **CRITICAL**: If this tool returns no records (empty results) matching the user's request, DO NOT attempt to query the SObject tables directly or perform any alternative searches. Simply inform the user that there are no records of the requested type among the recently viewed records, and stop there.

---
## Usage

### Example 1: Get recently viewed records
```json
{}
```

{
  "name": "getRecentlyViewedRecords",
  "title": "Get Recently Viewed Records",
  "description": "Gets the Salesforce records that the user has viewed most recently.",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "required": []
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "records": {
        "type": "array",
        "description": "List of recent records",
        "items": {
          "type": "object",
          "properties": {
            "Id": { "type": "string" },
            "Name": { "type": "string" },
            "SobjectType": { "type": "string" },
            "LastViewedDate": { "type": "string", "format": "date-time" }
          },
          "required": ["Id", "Name", "SobjectType", "LastViewedDate"]
        }
      }
    },
    "required": ["records"]
  }
}