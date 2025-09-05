/**
 * Custom test sequencer that ensures tests run in order: server -> tools -> rest
 */
class CustomSequencer {
  sort(tests) {
    // Create a copy of the tests array to avoid mutating the original
    const testsCopy = Array.from(tests);

    // Sort tests to prioritize: server -> tools -> rest
    return testsCopy.sort((testA, testB) => {
      const aPath = testA.path;
      const bPath = testB.path;

      // Define priority order: server (1), tools (2), rest (3)
      const getPriority = (path) => {
        if (path.includes('/server/')) {
          return 1;
        }
        if (path.includes('/tools/')) {
          return 2;
        }
        return 3;
      };

      const aPriority = getPriority(aPath);
      const bPriority = getPriority(bPath);

      // Compare priorities
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // If same priority, maintain alphabetical order for consistency
      return aPath.localeCompare(bPath);
    });
  }

  // Required method for Jest sequencer interface
  cacheResults() {
    // No-op implementation
  }
}

export default CustomSequencer;
