# Get Org And User Details

Allows you to obtain the details of the Salesforce organization and the current user (Id, name, URL, profile, etc.).

---
## Agent Instructions
- **MANDATORY**: When obtaining Salesforce organization and user details, you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct CLI commands, SOQL queries, or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.
- Always show the most relevant fields: Id, Name, domain URL, Profile, etc.
- If any field is not available, indicate it clearly.
- To get the user name, use the this tool instead of the "getState" action of the tool "salesforceMcpUtils".

---
## Usage

### Example 1: Get org and user details
```json
{}
```