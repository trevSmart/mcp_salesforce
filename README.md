<p>
  <img src="resources/images/ibmLogo.png" alt="IBM Logo" height="50"/>
  <img src="resources/images/salesforceLogo.png" alt="Salesforce Logo" height="50"/>
</p>

<table border="0">
  <tr>
    <td><img src="resources/images/mcpLogo.png" alt="MCP Logo" height="30"/></td>
    <td><h1 style="margin: 0;">Trevor.</h1><h2>An intuitive MCP server for Salesforce development by IBM.</h2></td>
  </tr>
</table>


This project provides a Model Context Protocol (MCP) server for Salesforce, enabling advanced automation, metadata management, and integration with Salesforce orgs via the Salesforce CLI and REST API.

## Features

- Retrieve Salesforce org and user details
- Create, update, and delete Salesforce records
- Deploy and retrieve Salesforce metadata
- Execute anonymous Apex code
- Query Salesforce data using SOQL
- Manage debug logs and audit trails
- Integrate with Einstein GPT Agentforce

## Requirements

- Node.js >= 14
- Salesforce CLI (`sf`)
- A Salesforce org with API access

## Installation

1. Clone this repository:
   ```bash
   git clone <repo-url>
   cd mcp_salesforce
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your environment variables in a `.env` file (see below).

## Environment Variables

Create a `.env` file in the project root with the following variables:

```
apiVersion=63.0
loginUrl=https://test.salesforce.com
clientId=YOUR_CLIENT_ID
clientSecret=YOUR_CLIENT_SECRET
username=YOUR_SF_USERNAME
password=YOUR_SF_PASSWORD
agentforceAgentId=YOUR_AGENTFORCE_ID
```

## Usage

Start the MCP Salesforce server:

```bash
npm start
```

Or, for CLI usage:

```bash
./bin/cli.js
```
## License

Licensed under the EUPL v1.2. See [LICENSE](LICENSE) for details.

## Cursor Installation Deeplink

You can install and launch the Salesforce MCP server directly from Cursor using the following deeplink:

```
cursor://anysphere.cursor-deeplink/mcp/install?name=salesforce-mcp&config=eyJjb21tYW5kIjoibm9kZSIsImFyZ3MiOlsiL1VzZXJzL21hcmNwbGEvRG9jdW1lbnRzL0ZlaW5hL1Byb2plY3Rlcy9tY3AvbWNwX3NhbGVzZm9yY2UvaW5kZXguanMiXX0=
```

> **Note:** GitHub does not support clickable links for custom protocols like `cursor://`. To use the deeplink, copy the above URL and paste it into the address bar of Cursor.

This link uses the `generateCursorInstallMcpDeeplink` function defined in `tools/utils.js` to facilitate integration with Cursor.
