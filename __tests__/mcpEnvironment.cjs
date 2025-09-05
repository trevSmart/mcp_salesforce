const {TestEnvironment} = require('jest-environment-node');
const {createMcpClient, disconnectMcpClient} = require('./helpers/mcpClient.js');

let sharedClient = null;

class MCPEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    if (!sharedClient) {
      console.log('=== GLOBAL SETUP: Creating shared MCP client ===');
      sharedClient = await createMcpClient();
      console.log('=== GLOBAL SETUP: Shared MCP client created successfully ===');

      process.once('exit', async () => {
        console.log('=== GLOBAL TEARDOWN: Disconnecting shared MCP client ===');
        await disconnectMcpClient(sharedClient);
        console.log('=== GLOBAL TEARDOWN: Shared MCP client disconnected successfully ===');
      });
    }
    this.global.sharedMcpClient = sharedClient;
  }
}

module.exports = MCPEnvironment;
