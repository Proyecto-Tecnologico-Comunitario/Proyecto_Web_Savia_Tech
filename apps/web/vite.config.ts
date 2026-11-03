// SPDX-License-Identifier: GPL-3.0-or-later

import { fileURLToPath, URL } from 'node:url';

import { loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

import { buildManifest, normaliseBasePath } from './src/pwa/manifest';

export default defineConfig(({ mode }) => {
  // El directorio del proyecto se resuelve desde este archivo, no desde el cwd.
  const appRoot = fileURLToPath(new URL('.', import.meta.url));
  const env = loadEnv(mode, appRoot, 'VITE_');

  // La base y el nombre se validan al cargar la configuración: un valor inválido detiene el build.
  const base = normaliseBasePath(env.VITE_BASE_PATH);
  const name = env.VITE_APP_NAME ?? 'SaviaTech';
  const shortName = env.VITE_APP_SHORT_NAME;

  return {
    base,
    build: {
      target: 'es2022',
      // Los mapas de fuente no deben terminar en la caché del service worker.
      sourcemap: false,
    },
    plugins: [
      VitePWA({
        strategies: 'generateSW',
        registerType: 'prompt',
        // El registro se hace desde `src/pwa/registerServiceWorker.ts`.
        injectRegister: false,
        manifest: buildManifest({ name, shortName, base }),
        // Los íconos ya entran por `globPatterns`; el plugin añade el manifiesto una sola vez.
        includeManifestIcons: false,
        workbox: {
          // Solo se precachea lo que emite el build; nunca datos de casos.
          globPatterns: ['**/*.{js,css,html,png,svg}'],
          globIgnores: ['**/*.map'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          // Sin activación automática: la actualización la decide la persona.
          skipWaiting: false,
          clientsClaim: false,
          runtimeCaching: [],
          inlineWorkboxRuntime: true,
          sourcemap: false,
        },
        devOptions: { enabled: false },
      }),
    ],
    test: {
      // Las pruebas de Playwright viven en `e2e/` y no deben ejecutarse con Vitest.
      include: ['src/**/*.test.ts'],
    },
  };
});
