// Test configuration
export const TEST_CONFIG = {
  // MCP Server configuration
  mcpServer: {
    startupDelay: 1000,
    timeout: 30000,
    serverPath: '../index.js'
  },

  // Salesforce configuration
  salesforce: {
    testOrgAlias: 'DEVSERVICE',
    defaultLogLevel: 'info'
  },

  // Test execution configuration
  tests: {
    parallel: false,
    retryFailed: 2,
    slowTestThreshold: 5000
  },

  // Logging levels
  logLevels: {
    emergency: 0,
    alert: 1,
    critical: 2,
    error: 3,
    warning: 4,
    notice: 5,
    info: 6,
    debug: 7
  },

  // Console colors for test output
  colors: {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    orange: '\x1b[38;5;208m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    pink: '\x1b[95m'
  }
};
