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
- `username`: If set, only the changes performed by this username will be returned (if not set, the changes from all users will be returned). **Note**: Uses exact word matching to avoid false positives. Query the username first to ensure you are using the correct one.
- `metadataName`: If set, only the changes performed in this metadata will be returned (if not set, the changes from all metadata will be returned). **Note**: Uses exact word matching to avoid false positives (e.g., searching for "MyApexClass" won't return changes for "MyApexClassTest"). Query the metadata name first to ensure you are using the correct one.,

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
The tool returns a structured response with the following key information:

### Structured Content
- `filters`: The applied filters (lastDays, username, metadataName)
- `setupAuditTrailFileTotalRecords`: Total number of records in the original file
- `setupAuditTrailFileFilteredTotalRecords`: Number of records after applying all filters
- `records`: Array of change records with the following structure:
  - `date`: The date and time of the change
  - `user`: The user who made the change
  - `section`: The section where the change was made
  - `action`: The action description

### Example Response Structure
```json
{
    "filters": {
        "lastDays": 30,
        "username": null,
        "metadataName": "CSBD_Opportunity"
    },
    "setupAuditTrailFileTotalRecords": 1500,
    "setupAuditTrailFileFilteredTotalRecords": 45,
    "records": [
        {
            "date": "12/8/2025, 11:54:14 CEST",
            "user": "john.doe@company.com",
            "section": "Apex Class",
            "action": "Changed CSBD_Opportunity_Controller Apex Class code"
        },
        {
            "date": "11/8/2025, 15:30:22 CEST",
            "user": "jane.smith@company.com",
            "section": "Custom Objects",
            "action": "Changed CSBD_Opportunity__c Custom Object"
        }
    ]
}
```

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