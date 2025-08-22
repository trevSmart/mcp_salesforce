import {TEST_CONFIG} from '../config.js';

export class MCPToolsTestSuite {
  constructor(mcpClient) {
    this.mcpClient = mcpClient;
  }

  // Get all available MCP tool tests
  getAvailableTests() {
    return [
      {
        name: 'Initialize MCP Connection',
        run: async () => {
          await this.mcpClient.initialize({name: 'IBM Salesforce MCP Test Client', version: '1.0.0'});
        },
        required: true
      },
      {
        name: 'List Available Tools',
        run: async () => {
          await this.mcpClient.listTools();
        },
        required: true
      },
      {
        name: 'Set Logging Level',
        run: async () => {
          await this.mcpClient.setLoggingLevel(TEST_CONFIG.salesforce.defaultLogLevel);
        },
        required: true
      },
      {
        name: 'getOrgAndUserDetails',
        run: async () => {
          await this.mcpClient.callTool('getOrgAndUserDetails', {});
        }
      },
      {
        name: 'salesforceMcpUtils getState',
        run: async () => {
          await this.mcpClient.callTool('salesforceMcpUtils', {action: 'getState'});
        }
      },
      {
        name: 'salesforceMcpUtils getCurrentDatetime',
        run: async () => {
          await this.mcpClient.callTool('salesforceMcpUtils', {action: 'getCurrentDatetime'});
        }
      },
      {
        name: 'salesforceMcpUtils clearCache',
        run: async () => {
          await this.mcpClient.callTool('salesforceMcpUtils', {action: 'clearCache'});
        }
      },
      {
        name: 'apexDebugLogs status',
        run: async () => {
          await this.mcpClient.callTool('apexDebugLogs', {action: 'status'});
        }
      },
      {
        name: 'apexDebugLogs on',
        run: async () => {
          await this.mcpClient.callTool('apexDebugLogs', {action: 'on'});
        }
      },
      {
        name: 'apexDebugLogs list',
        run: async () => {
          await this.mcpClient.callTool('apexDebugLogs', {action: 'list'});
        }
      },
      {
        name: 'apexDebugLogs get',
        run: async () => {
          // First get a log ID from the list operation
          const listResult = await this.mcpClient.callTool('apexDebugLogs', {action: 'list'});
          if (listResult.structuredContent && listResult.structuredContent.length > 0) {
            const firstLog = listResult.structuredContent[0];
            await this.mcpClient.callTool('apexDebugLogs', {
              action: 'get',
              logId: firstLog.Id
            });
          } else {
            console.log('No logs available to test get operation');
          }
        }
      },
      {
        name: 'apexDebugLogs off',
        run: async () => {
          await this.mcpClient.callTool('apexDebugLogs', {action: 'off'});
        }
      },
      {
        name: 'describeObject Account',
        run: async () => {
          await this.mcpClient.callTool('describeObject', {
            sObjectName: 'Account',
            include: 'fields'
          });
        }
      },
      {
        name: 'executeSoqlQuery',
        run: async () => {
          await this.mcpClient.callTool('executeSoqlQuery', {
            query: 'SELECT Id, Name FROM Account LIMIT 3'
          });
        }
      },
      {
        name: 'getRecentlyViewedRecords',
        run: async () => {
          return await this.mcpClient.callTool('getRecentlyViewedRecords', {});
        }
      },
      {
        name: 'getRecord',
        run: async () => {
          // Get a record ID from recently viewed records
          const recentlyViewed = await this.mcpClient.callTool('getRecentlyViewedRecords', {});
          if (recentlyViewed.records && recentlyViewed.records.length > 0) {
            const firstRecord = recentlyViewed.records[0];
            await this.mcpClient.callTool('getRecord', {
              sObjectName: firstRecord.SobjectType,
              recordId: firstRecord.Id
            });
          } else {
            // Fallback to a known Account ID if no recently viewed records
            await this.mcpClient.callTool('getRecord', {
              sObjectName: 'Account',
              recordId: '001KN00000Il3uUYAR'
            });
          }
        }
      },
      {
        name: 'getApexClassCodeCoverage',
        run: async () => {
          await this.mcpClient.callTool('getApexClassCodeCoverage', {
            classNames: ['TestMCPTool']
          });
        }
      }
    ];
  }

  // Run specific tests or all tests
  async runTests(testsToRun = null) {
    const availableTests = this.getAvailableTests();

    // Filter tests to run
    let testsToExecute = availableTests;
    if (testsToRun && testsToRun.length > 0) {
      // Always include required tests
      const requiredTests = availableTests.filter(test => test.required);

      // Filter selected tests
      const selectedTests = availableTests.filter(test =>
        !test.required && testsToRun.some(testName =>
          test.name.toLowerCase().includes(testName.toLowerCase())
        )
      );

      testsToExecute = [...requiredTests, ...selectedTests];

      console.log(`${TEST_CONFIG.colors.cyan}Running ${selectedTests.length} selected tests plus ${requiredTests.length} required tests${TEST_CONFIG.colors.reset}`);
    }

    return testsToExecute;
  }
}
