import { existsSync } from 'node:fs'

import js from '@eslint/js'
import tseslint from 'typescript-eslint'

// Decision 0004: the engine's API types are not committed. Locally they are required;
// in CI, where they cannot exist, code that uses the engine API is not linted.
const ENGINE_CODE = ['plugin/hooks/**', 'plugin/src/mod/**', 'plugin/tests/**']
const hasEngineTypes = existsSync(new URL('vendor/claude-code/index.d.ts', import.meta.url))
if (!hasEngineTypes && process.env.CI !== 'true') {
  throw new Error('vendor/claude-code/index.d.ts is missing. Run: npm run engine-types')
}

export default tseslint.config(
  {
    ignores: [
      'vendor/',
      '.claude-plugin/types/',
      'plugin/.claude-plugin/types/',
      '.scratch/',
      'node_modules/',
      ...(hasEngineTypes ? [] : ENGINE_CODE),
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'max-nested-callbacks': ['error', 3],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Decision 0003: the argument check of this rule never finishes on the engine's
    // on(event, hook) overloads. Scoped to code that calls the engine API.
    files: ENGINE_CODE,
    rules: {
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false } },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { process: 'readonly', URL: 'readonly' } },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { module: 'writable' } },
  },
)
