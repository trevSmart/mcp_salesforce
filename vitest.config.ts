import { defineConfig } from 'vitest/config';
export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		setupFiles: ['./test/setup.ts'],
		include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		coverage: {
			reporter: ['text', 'lcov'],
			include: ['src/**/*.{js,ts}']
		}
	}
});