# MCP Salesforce Server

A powerful server for interacting with Salesforce through the MCP protocol. This server provides a comprehensive set of tools for Salesforce development and administration tasks.

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
SF_LOGIN_URL=https://test.salesforce.com
SF_USERNAME=your-username
SF_PASSWORD=your-password
SF_SECURITY_TOKEN=your-security-token
```

## Available Tools

The server provides the following tools for Salesforce interaction:

### Core Operations
- `listObjects`: List all available Salesforce objects
- `describeObject`: Get detailed information about a specific object
- `getRecord`: Retrieve a specific record
- `createRecord`: Create a new record
- `updateRecord`: Update an existing record
- `deleteRecord`: Delete a record

### Development Tools
- `executeAnonymousApex`: Execute anonymous Apex code
- `toolingApiRequest`: Make requests to the Tooling API
- `deployMetadata`: Deploy metadata components
- `setDebugLogLevels`: Configure debug log levels

### Auditing and Monitoring
- `getSetupAuditTrail`: Query Setup Audit Trail changes with the following parameters:
  - `lastDays`: Number of days to query (1-365)
  - `createdByName`: Filter by user name (optional)
  - `metadataName`: Filter by metadata type (optional)

### Recently Viewed
- `getRecentlyViewedRecords`: Retrieve recently viewed records

## Requirements

- Node.js >= 16.0.0
- Salesforce organization with API access
- Appropriate Salesforce permissions for the connected user

## Development

### Running the Server

```bash
npm start
```

### Running Tests

```bash
npm test
```

### Debugging

The server includes comprehensive error logging. Check the console output for detailed error messages and stack traces.

## Error Handling

The server implements robust error handling for common scenarios:
- Invalid credentials
- Network connectivity issues
- Permission issues
- Invalid parameters
- Session management

## Security

- All sensitive information should be stored in environment variables
- The server implements secure connection handling
- API credentials are never logged or exposed

## License

EUPL-1.2

## Support

For issues and feature requests, please create an issue in the repository.

# MCP Salesforce Tools

This repository contains tools for interacting with Salesforce through the Model Context Protocol (MCP).

## Setup

1. Clone the repository
2. Fill in the required environment variables:
   - `salesforceInstanceUrl`: Salesforce instance URL
   - `apiVersion`: Salesforce API version
   - `loginUrl`: Salesforce authentication URL
   - `clientId`: Connected app Client ID
   - `clientSecret`: Connected app Client Secret

## Available Tools

### Setup Audit Trail

This tool allows querying the Setup Audit Trail history in Salesforce.

#### Usage

To use the tool, you can use the following prompt:

```
I want to see the Setup Audit Trail history for the last {days} days, for user {userName} and metadata filter {meta}.
```

Example:
```
I want to see the Setup Audit Trail history for the last 30 days, for user "John Doe" and metadata filter "Apex"
```

The response will include:
- Warning if there are more records available
- Each record will show the date, time, section, and description of the change

#### Troubleshooting

1. If the 'days' parameter is missing:
   - Error: "The 'days' parameter is required"
   - Solution: Specify the number of days to query

2. If the number of days is out of range:
   - Error: "The 'days' parameter must be between 1 and 365"
   - Solution: Adjust the number of days to the allowed range

3. If no records are found:
   - Solution: Try with a wider date range or adjust the filters

## Features

- Parameter validation
- Response formatting
- Error handling
- Edge cases

## Development

### Tests

To run the tests:

```bash
npm test
```

The tests cover:
- Parameter validation
- Response formatting
- Error handling
- Edge cases

### Contributing

1. Fork the repository
2. Create a branch for your feature
3. Make the necessary changes
4. Add tests for the new functionality
5. Submit a pull request