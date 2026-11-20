import js from '@eslint/js';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  module: 'readonly',
  require: 'readonly',
  __dirname: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
};

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  localStorage: 'readonly',
  console: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  alert: 'readonly',
};

export default [
  { ignores: ['node_modules/', 'dist/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['server/**/*.js', 'scripts/**/*.js', 'test/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: nodeGlobals },
  },
  {
    files: ['client/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: browserGlobals },
  },
  prettierConfig,
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
];
