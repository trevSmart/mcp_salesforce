import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TestMcpClient} from 'ibm-test-mcp-client';
import {TEST_CONFIG} from '../test/test-config.js';

export async function runSuite(suiteName, SuiteClass) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const serverPath = resolve(__dirname, TEST_CONFIG.mcpServer.serverPath);
  const client = new TestMcpClient();
  await client.connect({
    kind: 'script',
    interpreter: 'node',
    path: serverPath,
    args: ['--stdio']
  });
  const suite = new SuiteClass(client);
  const tests = await suite.runTests();
  describe(suiteName, () => {
    afterAll(async () => {
      await client.disconnect();
    });
    for (const t of tests) {
      const fn = async () => {
        await t.run();
      };
      if (t.canRunInParallel) {
        test.concurrent(t.name, fn);
      } else {
        test(t.name, fn);
      }
    }
  });
}
