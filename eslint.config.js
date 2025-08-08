// ESLint flat config for the extension
// See https://eslint.org/docs/latest/use/configure/migration-guide

import js from '@eslint/js';
import pluginImport from 'eslint-plugin-import';
import configPrettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      ecmaVersion: 2021,
      globals: {
        chrome: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        html2canvas: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        WebSocket: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        MutationObserver: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        InputEvent: 'readonly',
        Event: 'readonly',
        requestAnimationFrame: 'readonly',
        Node: 'readonly',
        NodeFilter: 'readonly',
        performance: 'readonly',
        btoa: 'readonly'
      }
    },
    plugins: {
      import: pluginImport
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off'
    }
  },
  configPrettier
];