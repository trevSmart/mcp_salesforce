## <img src="resources/images/ibmLogo.png" alt="IBM logo" width="52" style="position: relative; margin-right: 4px; top: 4px;"/> Salesforce MCP
A Model Context Protocol (MCP) server that provides Salesforce org context to your IDE AI agent

### Key features
Pending...

### Requirements
- Node.js v18 or newer
- Salesforce CLI connected to an org (only for internal testing)
- VS Code, Cursor, Windsurf, Claude Desktop or any other IDE supporting MCP

## Configuration
Crea un fitxer `.env` a l'arrel del projecte amb les variables necessàries per a la connexió (consulta l'equip de desenvolupament per als detalls).


### Getting started

First, install the Playwright MCP server with your client. A typical configuration looks like this:

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest"
      ]
    }
  }
}
```

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D)

<details><summary><b>Install in VS Code</b></summary>
After installation, the Playwright MCP server will be available for use with your GitHub Copilot agent in VS Code.
</details>

<details>
<summary><b>Install in Cursor</b></summary>

#### Click the button to install:

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=playwright&config=eyJjb21tYW5kIjoibnB4IEBwbGF5d3JpZ2h0L21jcEBsYXRlc3QifQ%3D%3D)

#### Or install manually:

Go to `Cursor Settings` -> `MCP` -> `Add new MCP Server`. Name to your liking, use `command` type with the command `npx @playwright/mcp`. You can also verify config or add command like arguments via clicking `Edit`.

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest"
      ]
    }
  }
}
```
</details>

<details>
<summary><b>Install in Windsurf</b></summary>

Follow Windsurf MCP [documentation](https://docs.windsurf.com/windsurf/cascade/mcp). Use following configuration:

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest"
      ]
    }
  }
}
```
</details>

<details>
<summary><b>Install in Claude Desktop</b></summary>

Follow the MCP install [guide](https://modelcontextprotocol.io/quickstart/user), use following configuration:

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest"
      ]
    }
  }
}
```
</details>

<details>
<summary><b>Install in Claude Code</b></summary>

Use the Claude Code CLI to add the Playwright MCP server:

```bash
claude mcp add playwright npx @playwright/mcp@latest
```
</details>


Follow the MCP install [guide](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md#configure-the-mcp-server-in-settingsjson), use following configuration:

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest"
      ]
    }
  }
}
```

## License
See the LICENSE file for details.
