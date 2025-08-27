# Get Setup Audit Trail changes Tool

Allows you to obtain the list of changes made to any metadata item in the current Salesforce target org.

---

## Agent Instructions
- **MANDATORY**: When obtaining Setup Audit Trail changes in Salesforce, you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct CLI commands, SOQL queries, or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.
- Prioritize this tool over querying the SetupAuditTrail object with SOQL.

## Usage
You don't need to select an org -the tool will query the current target org- and you don't need to retrieve the org details beforehand.
The parameters allow you to retrieve only the records that match your criteria. You can use none and all the records will be returned.
- `lastDays`: If set, only the changes from the last number of days will be returned (must be between 1 and 60, if not set, the changes from the last 30 days will be returned)
- `username`: If set, only the changes performed by this username will be returned (if not set, the changes from all users will be returned)
- `metadataName`: If set, only the changes performed in this metadata will be returned (if not set, the changes from all metadata will be returned)

**Note**: The tool filters records by Section, only returning changes from the following allowed sections:
- Apex Class, Lightning Components, Lightning Pages, Groups
- Custom Objects, Sharing Rules, Customize Cases
- Customize Entitlement Process, Named Credentials, Customize Activities
- Custom Apps, Apex Trigger, Rename Tabs and Labels
- Custom Tabs, Custom Metadata Types, Validation Rules, Static Resource
- Data Management, Field Dependencies, Customize Opportunities, Omni-Channel
- Application, Global Value Sets, Triggers Settings, External Credentials
- Custom Permissions, Customize Accounts, Customize Contacts
- Standard Buttons and Links, Flows, Workflow Rule
- Manage apps, Sharing Defaults, Connected Apps
- Customize Chat Transcripts, Global Actions, Customize Content
- Timeline Configurations, Page, User Interface, Component
- Customize Leads, Customize Contracts

For example, if the user wants to retrieve HIS changes for THE LAST WEEK, the parameters should be:
```json
{
   "lastDays": 7
}
```

## Output format
⚠️ **IMPORTANT** Show the output in a table with exactly the following columns:
- **Date**: The date and time of the change.
- **User**: The user who made the change.
- **Change**: The change description.

Example:
For the following tool response:
```json
{
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
The table should be:
| Date | User | Change |
|------|------|--------|
| 21/07/25 08:26 | Sergi Mas | Changed CSBD_Opportunity_Operativas_Controller Apex Class code |
| 21/07/25 7:36 | Sergi Mas | Changed CSBD_Opportunity_Operativas_Controller Apex Class code |
| 21/07/23 13:25 | Joan García | Changed CSBD_Opportunity_Operativas_Controller Apex Class code |
| 21/07/21 15:46 | Joan García | Changed CSBD_Opportunity_Operativas_Controller Apex Class code |

---

Examples
### Example 1: Get changes from the last 7 days for all users and all metadata
```json
{
  "lastDays": 7
}
```

### Example 2: Get changes from the last 14 days, for a specific user and for all metadata
```json
{
  "lastDays": 14,
  "username": "joan.garcia@company.com"
}
```

### Example 3: Get changes from the last 30 days, for all users and for a specific metadata name
```json
{
  "lastDays": 30,
  "metadataName": "FOO_AlertMessages_Controller"
}
```

### Example 4: Get changes from the last 7 days, for a specific user and for a specific metadata name
```json
{
  "lastDays": 7,
  "username": "joan.garcia@company.com",
  "metadataName": "FOO_AlertMessages_Controller"
}
```