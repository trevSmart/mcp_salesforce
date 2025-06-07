# Salesforce MCP Server

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

## Contributing

Pull requests are welcome! Please open an issue first to discuss any major changes.

## License

Licensed under the EUPL v1.2. See [LICENSE](LICENSE) for details.

## Deeplink de instalación para Cursor

Puedes instalar y lanzar el servidor MCP de Salesforce directamente desde Cursor usando el siguiente deeplink:

```
cursor://anysphere.cursor-deeplink/mcp/install?name=salesforce-mcp&config=eyJjb21tYW5kIjoibm9kZSIsImFyZ3MiOlsiL1VzZXJzL21hcmNwbGEvRG9jdW1lbnRzL0ZlaW5hL1Byb2plY3Rlcy9tY3AvbWNwX3NhbGVzZm9yY2UvaW5kZXguanMiXX0=
```

Este enlace utiliza la función `generateCursorInstallMcpDeeplink` definida en `tools/utils.js` para facilitar la integración con Cursor.
