# Get Setup Audit Trail changes

Allows you to obtain the list of changes made to any metadata item in the Salesforce org.

---

## Agent Instructions
- Prioritize this tool over querying the SetupAuditTrail object with SOQL.
- Pass the number of days to query in the lastDays parameter (required).
- Optionally, pass the user name in the createdByName parameter.
- Optionally, pass the metadata name in the metadataName parameter.
- If there are no changes, indicate it clearly.

## Required output format

⚠️ **IMPORTANT** The output is a markdown table of changes made to the metadata item. The table is sorted by date, in descending order.

The table must have the following fields:
- **Date**: The date and time of the change.
- **User**: The user who made the change.
- **Change**: The change description.

⚠️ **IMPORTANT** ALWAYS SHOW THE OUTPUT IN THE SAME FORMAT AS THE FOLLOWING EXAMPLE, WITH THESE 3 COLUMNS.

### Example of the output:
```json
{
    "sizeBeforeFilters": 2,
    "sizeAfterFilters": 2,
    "records": {
        "Sergi Mas": [
            "21/07/25 08:26 - Apex - Changed CSBD_Opportunity_Operativas_Controller Apex Class code",
            "21/07/25 7:36 - Apex - Changed CSBD_Opportunity_Operativas_Controller Apex Class code"
        ],
        "Joan García": [
            "21/07/23 13:25 - Apex - Changed CSBD_Opportunity_Operativas_Controller Apex Class code",
            "21/07/21 15:46 - Apex - Changed CSBD_Opportunity_Operativas_Controller Apex Class code"
        ]
    }
}
```

| Date | User | Change |
|------|------|--------|
| 21/07/25 08:26 | Sergi Mas | Changed CSBD_Opportunity_Operativas_Controller Apex Class code |
| 21/07/25 7:36 | Sergi Mas | Changed CSBD_Opportunity_Operativas_Controller Apex Class code |
| 21/07/23 13:25 | Joan García | Changed CSBD_Opportunity_Operativas_Controller Apex Class code |
| 21/07/21 15:46 | Joan García | Changed CSBD_Opportunity_Operativas_Controller Apex Class code |

---

## Usage

### Example 1: Get changes from the last 7 days
```json
{
  "lastDays": 7
}
```

### Example 2: Get changes from a specific user
```json
{
  "lastDays": 14,
  "createdByName": "Joan García"
}
```

### Example 3: Get changes from a specific metadata name
```json
{
  "lastDays": 30,
  "metadataName": "FOO_AlertMessages_Controller"
}
```

### Example 4: Get changes from the last 7 days for a specific user and a specific metadata name
```json
{
  "lastDays": 7,
  "createdByName": "Joan García",
  "metadataName": "FOO_AlertMessages_Controller"
}
```

