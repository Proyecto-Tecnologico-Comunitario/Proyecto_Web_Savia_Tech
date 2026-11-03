// SPDX-License-Identifier: GPL-3.0-or-later

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type BrowserContext, type Page } from '@playwright/test';

/** Origen servido por `vite preview`. */
const BASE_URL = 'http://127.0.0.1:4173';

/** Ruta del `sw.js` generado, leída desde el proceso de Playwright. */
const SERVICE_WORKER_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist',
  'sw.js',
);

/** Contenido de las cachés del origen, sin interpretar las respuestas. */
export interface CacheAudit {
  readonly keys: string[];
  readonly urls: string[];
  readonly texts: string[];
}

/** Devuelve la ruta usada como clave de caché para una URL del precaché. */
export function precachePath(url: string): string {
  return `/${url.replace(/^\/+/, '')}`;
}

/** Lee las URLs del precaché embebido en el `sw.js` del build. */
export async function readBuildPrecacheUrls(): Promise<string[]> {
  const source = await readFile(SERVICE_WORKER_FILE, 'utf8');
  const pattern = /\{url:"([^"]+)",revision:(?:"([^"]*)"|null)\}/g;
  const urls = new Set<string>();

  for (const match of source.matchAll(pattern)) {
    const url = match[1];
    if (url !== undefined) {
      urls.add(url);
    }
  }

  if (urls.size === 0) {
    throw new Error(`Could not read the precache manifest from ${SERVICE_WORKER_FILE}`);
  }

  return [...urls];
}

/** Espera a que el navegador tenga un service worker activo. */
export async function waitForServiceWorkerReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
}

/** Espera a que la página actual esté controlada por el service worker. */
export async function waitForController(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: 30_000,
    })
    .toBe(true);
}

/** Comprueba que la caché de precaché contiene todas las URLs del build. */
export async function expectPrecacheComplete(page: Page): Promise<string[]> {
  const urls = await readBuildPrecacheUrls();
  const expected = urls.map(precachePath);

  await expect
    .poll(
      () =>
        page.evaluate(async (paths) => {
          const names = (await caches.keys()).filter((name) => name.startsWith('workbox-precache'));
          const cached = new Set<string>();

          for (const name of names) {
            const cache = await caches.open(name);
            for (const request of await cache.keys()) {
              cached.add(new URL(request.url).pathname);
            }
          }

          return paths.filter((item) => cached.has(item)).length;
        }, expected),
      { timeout: 30_000 },
    )
    .toBe(expected.length);

  return urls;
}

/**
 * Deja la aplicación controlada por el service worker y con el precaché completo.
 *
 * La primera carga registra el worker; la recarga posterior hace que controle la página.
 */
export async function warmOfflineCache(page: Page): Promise<void> {
  await page.goto('/');
  await waitForServiceWorkerReady(page);
  await expectPrecacheComplete(page);
  await page.reload();
  await waitForController(page);
}

/** Corta la red del contexto, incluidos los recursos del mismo origen. */
export async function goOffline(context: BrowserContext): Promise<void> {
  await context.setOffline(true);
}

/** Devuelve claves, URLs y textos de todas las cachés del origen. */
export async function readCacheAudit(page: Page): Promise<CacheAudit> {
  return page.evaluate(async () => {
    const keys = await caches.keys();
    const urls: string[] = [];
    const texts: string[] = [];

    for (const key of keys) {
      const cache = await caches.open(key);

      for (const request of await cache.keys()) {
        urls.push(request.url);

        const response = await cache.match(request);
        if (response !== undefined) {
          texts.push(await response.text());
        }
      }
    }

    return { keys, urls, texts };
  });
}

/** Origen esperado por las utilidades; evita repetir la cadena en las pruebas. */
export const PWA_BASE_URL = BASE_URL;
