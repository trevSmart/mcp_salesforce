export default {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.js',
    '**/src/**/*.test.js',
    '**/src/**/*.spec.js'
  ],
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
    '/test/suites/'
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
  ]
};
