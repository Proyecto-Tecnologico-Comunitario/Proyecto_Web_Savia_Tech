// SPDX-License-Identifier: GPL-3.0-or-later

import { defineConfig, devices } from '@playwright/test';

/** Origen local usado por `vite preview` durante las pruebas. */
const BASE_URL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 1,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  reporter: process.env.CI === undefined ? 'list' : [['github'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    locale: 'es-ES',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // La compilación valida la CSP real y evita diferencias con el servidor de desarrollo.
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: BASE_URL,
    // Se compila siempre para no probar un `preview` antiguo que ya ocupara el puerto.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
