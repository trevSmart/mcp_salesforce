import { resolve } from 'node:path';
import { TestMcpClient } from 'ibm-test-mcp-client';

const SERVER_PATH = resolve(process.cwd(), 'src/mcp-server.js');

export async function createMcpClient() {
  const client = new TestMcpClient();
  await client.connect({
    kind: 'script',
    interpreter: 'node',
    path: SERVER_PATH,
    args: ['--stdio'],
  });
  // Allow the server time to initialise
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return client;
}

export async function disconnectMcpClient(client) {
  if (client) {
    await client.disconnect();
  }
}
