# MCP Salesforce Server

Advanced server for interacting with Salesforce using the MCP protocol. It provides a comprehensive set of tools for Salesforce development and administration tasks, optimized for automated workflows and integration with AI environments.

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root directory with the following required variables:

```env
apiVersion=63.0
loginUrl=https://test.salesforce.com
clientId=your-client-id
clientSecret=your-client-secret
username=your-username@example.com
password=your-password
agentforceAgentId=your-agentforce-id
```

> You can check the `utils/startMcpInspector.sh` script to see how these variables are loaded and validated.

## Available Tools

The server exposes the following tools for Salesforce interaction:

### Core Operations
- `orgDetails`: Get Salesforce organization information
- `currentUserDetails`: Get information about the connected user
- `describeObject`: Describe an SObject (fields, relationships, metadata)
- `getRecord`: Retrieve a specific record
- `createRecord`: Create a new record
- `updateRecord`: Update an existing record
- `deleteRecord`: Delete a record

### Development and Administration
- `executeAnonymousApex`: Execute anonymous Apex code (for testing or queries only)
- `deployMetadata`: Deploy metadata components
- `setDebugLogLevels`: Configure debug log levels
- `toolingApiRequest`: Make requests to the Tooling API
- `soqlQuery`: Execute SOQL queries (with Tooling API support)

### Auditing and Monitoring
- `getSetupAuditTrail`: Query the setup audit trail history (parameters: `lastDays`, `createdByName`, `metadataName`)
- `getRecentlyViewedRecords`: Show records recently viewed by the user

### Others (commented out by default, enabled only in advanced environments)
- `triggerExecutionOrder`: Analyze the execution order of automations for an SObject and DML operation
- `metadataApiRequest`: Retrieve metadata via force:source:retrieve
- `chatWithAgentforce`: Chat with an Einstein GPT agent configured in Salesforce

## Requirements

- Node.js >= 16.0.0
- Salesforce organization with API access and appropriate permissions
- Environment variables correctly configured

## Running the Server

```bash
npm start
```

For an enhanced visual and debugging experience, you can use the script:

```bash
sh utils/startMcpInspector.sh
```

This script validates the environment variables, starts the server, and opens the MCP Inspector interface in your browser.

## Tests

Currently, there are no automated tests. If you want to add them, create a test file and add your script to the `scripts` section in `package.json`.

## Error Handling

The server implements robust error handling for:
- Incorrect credentials or environment variables
- Network issues
- Insufficient permissions
- Invalid parameters
- Session management

Check the console output for detailed error messages.

## Security

- All sensitive information is managed via environment variables
- Credentials are never displayed or stored in logs
- The server uses secure connections by default

## License

EUPL-1.2

## Support

For issues or feature requests, please create an issue in the repository.

---

### Tool Usage Examples

#### Setup Audit Trail Query

```json
{
  "lastDays": 30,
  "createdByName": "John Doe",
  "metadataName": "Apex"
}
```

#### Creating a Record

```json
{
  "sObjectName": "Account",
  "fields": {
    "Name": "Test Company",
    "Phone": "123456789"
  }
}
```

#### Executing Anonymous Apex

```json
{
  "apexCode": "System.debug('Hello world!');"
}
```

---

For more details about each tool, check the source code in the `tools/` folder or the project's internal documentation.