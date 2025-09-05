/**
 * Custom test sequencer that ensures server tests run first
 */
class CustomSequencer {
  sort(tests) {
    // Create a copy of the tests array to avoid mutating the original
    const testsCopy = Array.from(tests);

    // Sort tests to prioritize server tests first
    return testsCopy.sort((testA, testB) => {
      const aPath = testA.path;
      const bPath = testB.path;

      // Check if test is in server directory
      const aIsServer = aPath.includes('/server/');
      const bIsServer = bPath.includes('/server/');

      // Server tests should run first
      if (aIsServer && !bIsServer) {
        return -1;
      }
      if (!aIsServer && bIsServer) {
        return 1;
      }

      // If both are server tests or both are not server tests,
      // maintain alphabetical order for consistency
      return aPath.localeCompare(bPath);
    });
  }
}

export default CustomSequencer;
