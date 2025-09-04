# Jest Setup Documentation

## Overview

Jest has been successfully installed and configured for this project. The project uses ES modules, so Jest is configured to work with the `--experimental-vm-modules` flag.

## Available Scripts

### Basic Testing
```bash
# Run all Jest tests
npm run test:jest

# Run Jest tests in watch mode (re-runs on file changes)
npm run test:jest:watch

# Run Jest tests with coverage report
npm run test:jest:coverage
```

### Legacy Testing (Original Test Runner)
```bash
# Run original test runner
npm test

# Run specific tests with original runner
npm run "test salesforceMcpUtils"
```

## Test File Structure

Jest will automatically find and run test files that match these patterns:
- `**/__tests__/**/*.js`
- `**/?(*.)+(spec|test).js`

### Example Test File
```javascript
// src/__tests__/example.test.js
describe('Example Test Suite', () => {
  test('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should handle async operations', async () => {
    const result = await Promise.resolve('async result');
    expect(result).toBe('async result');
  });
});
```

## Configuration

The Jest configuration is in `jest.config.js` and includes:
- Node.js test environment
- Coverage reporting (text, lcov, html)
- ES modules support
- Coverage collection from `src/**/*.js` files

## Coverage Reports

Coverage reports are generated in the `coverage/` directory and include:
- HTML report: `coverage/index.html`
- LCOV report: `coverage/lcov.info`
- Console output with coverage percentages

## Writing Tests

### Basic Test Structure
```javascript
describe('Test Suite Name', () => {
  test('test description', () => {
    // Test implementation
    expect(actualValue).toBe(expectedValue);
  });
});
```

### Common Assertions
```javascript
// Equality
expect(value).toBe(expected);
expect(value).toEqual(expected);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();

// Numbers
expect(value).toBeGreaterThan(expected);
expect(value).toBeLessThan(expected);

// Strings
expect(string).toContain(substring);
expect(string).toMatch(regex);

// Arrays
expect(array).toHaveLength(expected);
expect(array).toContain(item);

// Objects
expect(object).toHaveProperty(propertyName);
expect(object).toEqual(expectedObject);
```

### Async Testing
```javascript
test('async test', async () => {
  const result = await someAsyncFunction();
  expect(result).toBe(expected);
});

test('async test with done callback', (done) => {
  someAsyncFunction().then(result => {
    expect(result).toBe(expected);
    done();
  });
});
```

## Integration with Existing Tests

The project maintains both testing systems:
- **Jest**: For new tests and modern testing practices
- **Original Test Runner**: For existing tests and specific Salesforce MCP functionality

You can use either system depending on your needs. Jest is recommended for new tests due to its modern features and better ES modules support.
