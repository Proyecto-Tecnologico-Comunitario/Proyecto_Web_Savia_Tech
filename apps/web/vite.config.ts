// SPDX-License-Identifier: GPL-3.0-or-later

import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    target: 'es2022',
  },
  test: {
    // Las pruebas de Playwright viven en `e2e/` y no deben ejecutarse con Vitest.
    include: ['src/**/*.test.ts'],
  },
});
