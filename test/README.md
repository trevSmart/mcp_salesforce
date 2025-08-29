# Test Structure

This directory contains all tests for the IBM Salesforce MCP project.

## Structure

```
test/
├── runner.js              # Main test runner (uses `ibm-test-mcp-client`)
├── helpers.js             # Helper functions and infrastructure management
├── test-config.js         # Test configuration
├── suites/                # Test suites organized by functionality
│   └── mcp-tools.js       # Tests for MCP tools
└── fixtures/              # Test data (future)
```

## How to Run Tests

### Run all tests
```bash
npm test
```

### Run specific tests
```bash
npm test -- --tests=apexDebugLogs,getRecord
```

### Set log level
```bash
npm test -- --logLevel=debug
```

### Output modes
```bash
# Compact output (hides tool details)
npm test -- --compact

# Minimal output (one line per test)
npm test -- --quiet
```

### See help
```bash
npm run test:help
```

## Code Organization

### `runner.js`
- Coordinates the execution of all tests
- Manages the MCP server lifecycle
- Prints summaries and test results

### MCP client
- `runner.js` uses the `ibm-test-mcp-client` package to start and manage the MCP connection (via stdio).
- Key client functions: `connect`, `disconnect`, `setLoggingLevel`, `listTools`, `callTool`.

### `helpers.js`
- **MCPServerManager**: Manages starting and stopping the MCP server
- **SalesforceOrgManager**: Manages switching Salesforce orgs
- **TestHelpers**: Test helper utilities

### `test-config.js`
- Centralized test configuration
- Constants for colors, timeouts, and settings

### `suites/mcp-tools.js`
- Contains all tests for MCP tools
- Organizes tests by functionality
- Allows running specific tests or all

## Adding New Tests

To add new tests:

1. **MCP tool tests**: Add them to `suites/mcp-tools.js`
2. **Unit tests**: Create `suites/unit.js`
3. **Integration tests**: Create `suites/integration.js`

## Example: Adding a Test

```javascript
// In suites/mcp-tools.js
{
  name: 'New Test',
  run: async () => {
    await this.mcpClient.callTool('toolName', {param: 'value'});
  }
}
```

## Advantages of the New Structure

1. **Separation of concerns**: Each file has a specific purpose
2. **Reuse**: MCP client and helpers are shared across tests
3. **Maintainability**: Easy to find and modify specific tests
4. **Scalability**: Easy to add new types of tests
5. **Centralized configuration**: All parameters in one place
