#!/usr/bin/env node
// SPDX-License-Identifier: MIT

// Regenera los íconos PNG a partir de los SVG. No se ejecuta en CI: los PNG se commitean.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = path.join(root, 'apps', 'web', 'public', 'icons');

// Cada salida declara el SVG de origen y el tamaño exacto en píxeles.
const targets = [
  { source: 'icon.svg', size: 192, output: 'icon-192.png' },
  { source: 'icon.svg', size: 512, output: 'icon-512.png' },
  { source: 'icon-maskable.svg', size: 512, output: 'icon-maskable-512.png' },
  { source: 'icon-maskable.svg', size: 180, output: 'apple-touch-icon.png' },
];

async function readSvg(name) {
  return readFile(path.join(iconsDir, name), 'utf8');
}

// El fondo se pinta en la página para que los PNG no tengan transparencia.
async function renderIcon(browser, svg, size, output) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });

  await page.setContent(
    `<!doctype html><html><head><style>
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #0f766e; }
      svg { display: block; width: 100vw; height: 100vh; }
    </style></head><body>${svg}</body></html>`,
  );

  await page.screenshot({
    path: path.join(iconsDir, output),
    omitBackground: false,
  });
  await page.close();
}

let browser;
try {
  browser = await chromium.launch();
} catch {
  console.error('Chromium no está instalado. Ejecuta `npm run e2e:install` y vuelve a intentarlo.');
  process.exit(1);
}

try {
  for (const target of targets) {
    const svg = await readSvg(target.source);
    await renderIcon(browser, svg, target.size, target.output);
    console.log(`${target.output} (${target.size}x${target.size})`);
  }
} finally {
  await browser.close();
}
