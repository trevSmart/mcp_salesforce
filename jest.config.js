export default {
  testEnvironment: '<rootDir>/__tests__/mcpEnvironment.cjs',
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/src/**/*.test.js',
    '**/src/**/*.spec.js'
  ],
  testSequencer: '<rootDir>/__tests__/testSequencer.js',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/tmp/',
    '/.vscode/',
    '/.git/',
    '/.cursor/',
    '/bin/',
    '/dev/',
    '/docs/',
    '/test/suites/',
    '/force-app/'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  transform: {},
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  maxWorkers: 1,
  // Add timeout and handle detection
  testTimeout: 30000, // 30 seconds timeout for tests
  detectOpenHandles: true,
  forceExit: true, // Force exit after tests complete
  // Add setup and teardown
  setupFilesAfterEnv: ['<rootDir>/__tests__/setupAfterEnv.js']
};
