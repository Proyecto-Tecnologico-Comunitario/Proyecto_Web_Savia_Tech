// SPDX-License-Identifier: MIT
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'docs/design/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
  {
    files: ['apps/web/src/crypto/**/*.ts'],
    rules: {
      // La criptografía no puede escribir secretos ni datos sensibles en la consola.
      'no-console': 'error',
      // La aleatoriedad debe salir solo de WebCrypto.
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use crypto.getRandomValues for randomness',
        },
      ],
      // Los secretos no pueden terminar en almacenamiento web no cifrado.
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Do not store crypto material in web storage' },
        { name: 'sessionStorage', message: 'Do not store crypto material in web storage' },
      ],
      // Solo se permite la Web Crypto API nativa.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'crypto',
                'node:crypto',
                'crypto-js',
                'crypto-js/*',
                'node-forge',
                'node-forge/*',
                'sjcl',
                'tweetnacl',
                'libsodium-wrappers',
              ],
              message: 'Use the native Web Crypto API instead of an external crypto library',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
