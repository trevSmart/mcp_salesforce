import {jest} from '@jest/globals';

// Increase timeout for all tests
jest.setTimeout(30000);

// Clean up after each test
afterEach(async () => {
	jest.clearAllTimers();
	await new Promise((resolve) => setTimeout(resolve, 100));
});
