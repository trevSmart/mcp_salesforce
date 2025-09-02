import path from 'node:path';
import {fileURLToPath} from 'node:url';
import js from '@eslint/js';
import globals from 'globals';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Translate ESLintRC-style configs into flat configs.

export default [
	// ESLint recommended config
	js.configs.recommended,

	// Base configuration
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},

	// Main rules
	{
		rules: {
			'no-console': ['error', {allow: ['error']}],
			'no-debugger': 'warn',
			'no-dupe-args': 'error',
			'no-dupe-keys': 'error',
			'no-duplicate-case': 'error',
			'no-empty': 'error',
			'no-extra-boolean-cast': 'error',
			'no-extra-semi': 'error',
			'no-unreachable': 'error',
			// New rules from the provided list
			'no-dupe-class-members': 'error',
			'no-empty-character-class': 'error',
			'no-dupe-else-if': 'error',
			'no-duplicate-imports': 'error',
			'no-empty-pattern': 'error',
			'no-return-assign': 'off',
			'no-compare-neg-zero': 'error',
			'no-cond-assign': 'error',
			'no-constant-binary-expression': 'error',
			'no-constant-condition': 'error',
			'no-ex-assign': 'error',
			'no-func-assign': 'error',
			'no-misleading-character-class': 'error',
			'no-obj-calls': 'error',
			'no-promise-executor-return': 'off',
			'no-new-native-nonconstructor': 'error',
			'no-loss-of-precision': 'error',
			'no-irregular-whitespace': 'error',
			'no-invalid-regexp': 'error',
			'no-inner-declarations': 'error',
			'no-self-assign': 'error',
			'no-unassigned-vars': 'error',
			'no-template-curly-in-string': 'error',
			'no-sparse-arrays': 'warn',
			'no-unexpected-multiline': 'error',
			'no-useless-assignment': 'error',
			'no-multi-spaces': 'error',
			'no-unused-expressions': ['error', {allowShortCircuit: true}],
			'quote-props': ['error', 'consistent-as-needed', {unnecessary: false}],

			// Best Practices
			curly: ['error', 'all'],
			eqeqeq: ['error', 'smart'],
			'no-empty-function': 'error',
			'no-eval': 'error',
			'no-self-compare': 'error',
			'no-useless-return': 'error',

			// Variables
			'no-shadow': 'error',
			'no-unused-vars': 'warn',
			'no-use-before-define': ['error', {functions: false}],

			// Stylistic Issues
			'array-bracket-spacing': ['error', 'never'],
			'block-spacing': ['error', 'always'],
			'brace-style': ['error', '1tbs', {allowSingleLine: false}],
			'comma-dangle': ['error', 'never'],
			'comma-spacing': ['error', {before: false, after: true}],
			indent: ['error', 'tab', {SwitchCase: 1}],
			'key-spacing': ['error', {beforeColon: false, afterColon: true}],
			'keyword-spacing': ['error', {before: true, after: true}],
			'linebreak-style': ['error', 'unix'],
			'max-len': [
				'warn',
				{
					code: 300,
					ignoreTemplateLiterals: true,
					ignoreUrls: true,
					ignoreStrings: true
				}
			],
			'no-mixed-spaces-and-tabs': 'error',
			'no-trailing-spaces': 'warn',
			'nonblock-statement-body-position': ['error', 'beside'],
			'object-curly-spacing': ['error', 'never'],
			quotes: ['error', 'single', {avoidEscape: true}],
			semi: ['error', 'always'],
			'space-before-blocks': ['error', 'always'],
			'space-before-function-paren': [
				'error',
				{
					anonymous: 'never',
					named: 'never',
					asyncArrow: 'never'
				}
			],
			'space-in-parens': ['error', 'never'],
			'space-infix-ops': 'error'
		}
	},

	// Special rules for dev files
	{
		files: ['dev/**/*.{js,mjs,cjs}'],
		rules: {
			'no-console': 'off',
			'max-len': [
				'warn',
				{
					code: 300,
					ignoreTemplateLiterals: true,
					ignoreUrls: true,
					ignoreStrings: true
				}
			]
		}
	},

	// Special rules for test files
	{
		files: ['test/**/*.{js,mjs,cjs,ts}'],
		rules: {
			'no-console': 'off',
			'max-len': [
				'warn',
				{
					code: 300,
					ignoreTemplateLiterals: true,
					ignoreUrls: true,
					ignoreStrings: true
				}
			]
		}
	},

	// Ignore patterns for non-JavaScript files and directories
	{
		ignores: ['venv/**', 'node_modules/**', 'notebooks/**', '*.py', '*.pyc', '__pycache__/**', '.venv/**', 'env/**', '.env/**', '.eslint.config.js', 'tmp/**', 'eslint.config.js', 'dist/**']
	}
];
