<p>
  <img src="resources/images/ibmLogo.png" alt="IBM Logo" height="40"/>
  <img src="resources/images/salesforceLogo.png" alt="Salesforce Logo" height="40"/>
</p>

<img src="resources/images/mcpLogo.png" alt="IBM Logo" height="26"/>
IBM Salesforce MCP server

This project provides a Model Context Protocol (MCP) server for Salesforce, enabling advanced automation, metadata management, and integration with Salesforce orgs via the Salesforce CLI and REST API.

## Features

- Query, create, update, and delete records
- Deploy and retrieve Salesforce metadata
- Execute anonymous Apex scripts
- Build SOQL queries with generative AI
- Manage Apex debug logs
- Review your org's setup audit trail
- Integrate with Agentforce agents

## Requirements

- [Node.js](https://nodejs.org/) v14 or higher
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) connected to a Salesforce org
- An AI-enabled IDE or tool that supports MCP servers, such as:
  - [Cursor](https://www.cursor.com)
  - [Visual Studio Code](https://code.visualstudio.com)
  - [Claude](https://claude.ai)
  - [Windsurf](https://windsurf.com/editor)

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
SfApiVersion=63.0
SfLoginUrl=https://test.salesforce.com
SfClientId=YOUR_CLIENT_ID
SfClientSecret=YOUR_CLIENT_SECRET
SfUsername=YOUR_SF_USERNAME
SfPassword=YOUR_SF_PASSWORD
SfAgentforceAgentId=YOUR_AGENTFORCE_ID
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

## Add to Cursor IDE

You can install and launch the Salesforce MCP server directly from Cursor using the following deeplink:

```
cursor://anysphere.cursor-deeplink/mcp/install?name=salesforce-mcp&config=eyJjb21tYW5kIjoibm9kZSIsImFyZ3MiOlsiL1VzZXJzL21hcmNwbGEvRG9jdW1lbnRzL0ZlaW5hL1Byb2plY3Rlcy9tY3AvbWNwX3NhbGVzZm9yY2UvaW5kZXguanMiXSwiZW52Ijp7ImFwaVZlcnNpb24iOiI2My4wIiwibG9naW5VcmwiOiJodHRwczovL3Rlc3Quc2FsZXNmb3JjZS5jb20iLCJhZ2VudGZvcmNlQWdlbnRJZCI6IllPVVJfQUdFTlRGT1JDRV9JRCJ9fQ==
```

> **Note:** GitHub does not support clickable links for custom protocols like `cursor://`. To use the deeplink, copy the above URL and paste it into the address bar of your web browser.