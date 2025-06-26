# Get Recently Viewed Records

Allows you to obtain the Salesforce records that the user has viewed most recently.

---
## Agent Instructions
- Show each record as a markdown link to its detail URL.
- If the list is empty, indicate it clearly.

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