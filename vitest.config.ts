import { defineConfig } from 'vitest/config';
export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		setupFiles: ['./test/setup.ts'],
		include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		coverage: {
			enabled: true,
			reporter: ['text', 'html', 'lcov'],
			include: ['*.js', '*.ts', 'src/**/*.js', 'src/**/*.ts'],
			provider: 'v8',
			all: true,
			exclude: [
				'**/*.test.*',
				'**/__tests__/**',
				'node_modules/**',
				'dist/**',
				'coverage/**'
			],
			reportsDirectory: './coverage'
		}
	}
});