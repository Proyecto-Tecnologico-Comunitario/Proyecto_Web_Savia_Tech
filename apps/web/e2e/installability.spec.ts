// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from './fixtures';

/** Firma de los archivos PNG servidos por la aplicación. */
const PNG_SIGNATURE = '89504e47';

test('is installable and serves its manifest, icons and metadata', async ({ page, context }) => {
  await page.goto('/');

  const session = await context.newCDPSession(page);

  // Chromium no encuentra ningún impedimento de instalación.
  const { installabilityErrors } = await session.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);

  const appManifest = await session.send('Page.getAppManifest');
  expect(appManifest.errors).toEqual([]);

  const data = appManifest.data;
  if (data === undefined) {
    throw new Error('Chromium did not return the web app manifest');
  }

  const manifest = JSON.parse(data) as {
    name: string;
    short_name: string;
    id: string;
    start_url: string;
    scope: string;
    display: string;
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
  };

  expect(manifest.name).toBe('SaviaTech');
  expect(manifest.short_name).toBe('SaviaTech');
  expect(manifest.id).toBe('/');
  expect(manifest.start_url).toBe('/');
  expect(manifest.scope).toBe('/');
  expect(manifest.display).toBe('standalone');

  const expectedIcons = [
    { src: '/icons/icon-192.png', sizes: '192x192', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', purpose: 'any' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' },
  ];

  expect(manifest.icons).toHaveLength(expectedIcons.length);

  for (const expected of expectedIcons) {
    const icon = manifest.icons.find((item) => item.src === expected.src);
    expect(icon, `missing icon ${expected.src}`).toBeDefined();
    expect(icon?.sizes).toBe(expected.sizes);
    expect(icon?.type).toBe('image/png');
    expect(icon?.purpose).toBe(expected.purpose);

    // El archivo declarado se sirve y es un PNG real.
    const response = await page.request.get(expected.src);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');

    const body = await response.body();
    expect(body.subarray(0, 4).toString('hex')).toBe(PNG_SIGNATURE);
  }

  // El HTML declara el manifiesto, el ícono, el ícono de iOS y los dos temas.
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/icons/icon.svg');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/icons/apple-touch-icon.png',
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
});
