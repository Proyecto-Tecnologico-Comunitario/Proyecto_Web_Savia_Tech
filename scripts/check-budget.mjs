#!/usr/bin/env node
// SPDX-License-Identifier: MIT

// Audita el build de la PWA y comprueba el presupuesto de tamaño.
// Se ejecuta después de `npm run build`; cualquier fallo de auditoría termina con código 1.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'apps', 'web', 'dist');
const budgetFile = path.join(root, 'apps', 'web', 'bundle-budget.json');

// La CSP no debe cambiar en T7; el build falla si el HTML se desvía de esta cadena.
const EXPECTED_CSP =
  "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'";

// Términos que no deben aparecer en el manifiesto; el nombre instalado es visible fuera de la app.
const SENSITIVE_TERMS = [
  'violencia',
  'violence',
  'mujer',
  'woman',
  'women',
  'riesgo',
  'risk',
  'tamizaje',
  'screening',
  'salud mental',
  'mental health',
];

const FORBIDDEN_MANIFEST_FIELDS = [
  'description',
  'categories',
  'shortcuts',
  'screenshots',
  'share_target',
  'file_handlers',
  'protocol_handlers',
  'related_applications',
  'orientation',
];

// Cadenas inocuas del runtime de Workbox que no son peticiones de red.
const ALLOWED_SW_URLS = ['https://bit.ly/wb-precache'];

const failures = [];

/** Registra un fallo de auditoría sin detener el resto de comprobaciones. */
function fail(message) {
  failures.push(message);
}

/** Comprueba que una ruta existe antes de leerla. */
function requireFile(file, label) {
  if (!existsSync(file)) {
    fail(`${label} is missing: ${path.relative(root, file)}`);
    return false;
  }

  return true;
}

/** Comprime con gzip nivel 9, el método determinista del presupuesto. */
function gzipSize(buffer) {
  return zlib.gzipSync(buffer, { level: 9 }).length;
}

/** Convierte una URL del build en una ruta local dentro de `dist`. */
function localPath(url) {
  const clean = url.split('?')[0].split('#')[0];
  const relative = clean.replace(/^\/+/, '');

  return path.resolve(distDir, relative);
}

/** Indica si la URL es relativa al mismo origen y no escapa de `dist`. */
function isLocalUrl(url) {
  if (/^[a-z]+:/i.test(url) || url.startsWith('//') || url.includes('..')) {
    return false;
  }

  if (url.includes('?') || url.includes('#')) {
    return false;
  }

  const resolved = localPath(url);
  const prefix = `${distDir}${path.sep}`;

  return resolved.startsWith(prefix);
}

/** Devuelve los valores de un atributo en todas las etiquetas `<link>`. */
function linkAttribute(html, attribute) {
  return [...html.matchAll(/<link\b[^>]*>/g)]
    .map((match) => match[0].match(new RegExp(`\\b${attribute}="([^"]*)"`))?.[1])
    .filter((value) => value !== undefined);
}

/** Devuelve los `src` de los `<script>` con archivo. */
function scriptSources(html) {
  return [...html.matchAll(/<script\b[^>]*>/g)]
    .map((match) => match[0].match(/\bsrc="([^"]*)"/)?.[1])
    .filter((value) => value !== undefined);
}

/** Suma el gzip de cada archivo único referenciado por el HTML. */
async function sumGzip(urls) {
  let total = 0;

  for (const url of new Set(urls)) {
    if (!isLocalUrl(url)) {
      fail(`Asset URL is not local: ${url}`);
      continue;
    }

    const file = localPath(url);
    if (!requireFile(file, `Referenced asset ${url}`)) {
      continue;
    }

    total += gzipSize(await readFile(file));
  }

  return total;
}

/** Extrae el manifiesto de precaché embebido en `sw.js`. */
function parsePrecache(sw) {
  if (!/precache(?:AndRoute)?\(/.test(sw)) {
    fail('sw.js does not contain a precache call');
    return [];
  }

  const entries = [];
  const pattern = /\{url:"([^"]+)",revision:(?:"([^"]*)"|null)\}/g;

  for (const match of sw.matchAll(pattern)) {
    entries.push({ url: match[1], revision: match[2] ?? null });
  }

  if (entries.length === 0) {
    fail('The precache manifest could not be parsed from sw.js');
  }

  return entries;
}

/** Comprueba la firma PNG y devuelve sus dimensiones reales. */
function pngDimensions(buffer) {
  const signature = buffer.subarray(0, 4).toString('hex');
  const isPng = signature === '89504e47' && buffer.subarray(12, 16).toString('ascii') === 'IHDR';

  if (!isPng) {
    return null;
  }

  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** Recorre el manifiesto y devuelve todos sus textos. */
function collectStrings(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output);
    }
    return output;
  }

  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectStrings(item, output);
    }
  }

  return output;
}

/** Normaliza un texto para buscar términos sin depender de mayúsculas ni acentos. */
function normalise(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Audita el HTML generado. */
function auditHtml(html) {
  const manifestLinks = linkAttribute(html, 'rel').filter((rel) => rel === 'manifest');

  if (manifestLinks.length !== 1) {
    fail(`index.html must contain exactly one manifest link (found ${manifestLinks.length})`);
  }

  if (/<script\b(?![^>]*\bsrc=)/.test(html)) {
    fail('index.html contains an inline script');
  }

  if (/<style\b/.test(html)) {
    fail('index.html contains an inline style element');
  }

  if (/\bstyle\s*=/.test(html)) {
    fail('index.html contains a style attribute');
  }

  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];

  if (csp !== EXPECTED_CSP) {
    fail('The Content-Security-Policy changed or contains unsafe directives');
  }
}

/** Audita el service worker y devuelve sus métricas. */
async function auditServiceWorker(sw) {
  if (sw.includes('importScripts(')) {
    fail('sw.js contains importScripts(); it must be a single file');
  }

  const urls = sw.match(/https?:\/\/[^\s"'`]+/g) ?? [];

  for (const url of urls) {
    if (!ALLOWED_SW_URLS.some((allowed) => url.startsWith(allowed))) {
      fail(`sw.js contains an unexpected URL: ${url}`);
    }
  }

  const entries = parsePrecache(sw);
  const unique = new Map(entries.map((entry) => [entry.url, entry]));

  let precacheBytes = 0;

  for (const url of unique.keys()) {
    if (url === 'sw.js') {
      fail('The precache must not include sw.js');
      continue;
    }

    if (!isLocalUrl(url)) {
      fail(`The precache contains a non-local URL: ${url}`);
      continue;
    }

    const file = localPath(url);
    if (!requireFile(file, `Precached file ${url}`)) {
      continue;
    }

    precacheBytes += (await readFile(file)).length;
  }

  return { precacheBytes, entries: unique.size };
}

/** Audita el manifiesto web y sus íconos. */
async function auditManifest(manifest) {
  for (const field of FORBIDDEN_MANIFEST_FIELDS) {
    if (Object.hasOwn(manifest, field)) {
      fail(`manifest.webmanifest must not include "${field}"`);
    }
  }

  for (const text of collectStrings(manifest)) {
    const value = normalise(text);
    if (SENSITIVE_TERMS.some((term) => value.includes(term))) {
      fail('manifest.webmanifest contains a sensitive term');
    }
  }

  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    fail('manifest.webmanifest declares no icons');
    return;
  }

  for (const icon of manifest.icons) {
    if (icon.type !== 'image/png') {
      fail(`Icon ${icon.src ?? '(unknown)'} is not a PNG`);
      continue;
    }

    if (!isLocalUrl(icon.src)) {
      fail(`Icon URL is not local: ${icon.src}`);
      continue;
    }

    const file = localPath(icon.src);
    if (!requireFile(file, `Icon ${icon.src}`)) {
      continue;
    }

    const size = /^(\d+)x(\d+)$/.exec(icon.sizes ?? '');
    if (size === null) {
      fail(`Icon ${icon.src} has an invalid sizes value`);
      continue;
    }

    const buffer = await readFile(file);
    const dimensions = pngDimensions(buffer);

    if (dimensions === null) {
      fail(`Icon ${icon.src} is not a valid PNG`);
      continue;
    }

    if (dimensions.width !== Number(size[1]) || dimensions.height !== Number(size[2])) {
      fail(`Icon ${icon.src} is ${dimensions.width}x${dimensions.height}, expected ${icon.sizes}`);
    }
  }
}

/** Imprime la tabla de presupuesto y devuelve si algún límite se superó. */
function printBudget(metrics, warnRatio) {
  const rows = metrics.map((metric) => {
    const margin = metric.limit - metric.actual;
    const status =
      metric.actual > metric.limit
        ? 'fail'
        : metric.actual >= metric.limit * warnRatio
          ? 'warn'
          : 'ok';

    if (status === 'fail') {
      fail(`${metric.name} exceeds its budget (${metric.actual} B > ${metric.limit} B)`);
    }

    return {
      name: metric.name,
      actual: `${metric.actual} B`,
      limit: `${metric.limit} B`,
      margin: `${margin} B`,
      status,
    };
  });

  const widths = {
    name: Math.max(5, ...rows.map((row) => row.name.length)),
    actual: Math.max(6, ...rows.map((row) => row.actual.length)),
    limit: Math.max(5, ...rows.map((row) => row.limit.length)),
    margin: Math.max(6, ...rows.map((row) => row.margin.length)),
  };

  console.log(
    [
      'Metric'.padEnd(widths.name),
      'Actual'.padStart(widths.actual),
      'Limit'.padStart(widths.limit),
      'Margin'.padStart(widths.margin),
      'Status',
    ].join('  '),
  );

  for (const row of rows) {
    console.log(
      [
        row.name.padEnd(widths.name),
        row.actual.padStart(widths.actual),
        row.limit.padStart(widths.limit),
        row.margin.padStart(widths.margin),
        row.status,
      ].join('  '),
    );
  }
}

async function main() {
  if (!requireFile(budgetFile, 'Bundle budget')) {
    return;
  }

  const budget = JSON.parse(await readFile(budgetFile, 'utf8'));
  const indexPath = path.join(distDir, 'index.html');
  const swPath = path.join(distDir, 'sw.js');
  const manifestPath = path.join(distDir, 'manifest.webmanifest');

  if (!requireFile(indexPath, 'index.html') || !requireFile(swPath, 'sw.js')) {
    return;
  }

  const html = await readFile(indexPath, 'utf8');
  auditHtml(html);

  const sw = await readFile(swPath, 'utf8');
  const serviceWorker = await auditServiceWorker(sw);

  if (!requireFile(manifestPath, 'manifest.webmanifest')) {
    return;
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await auditManifest(manifest);

  // El JS inicial es el que el HTML carga de entrada; los fragmentos dinámicos van al precaché.
  const scripts = scriptSources(html);
  const preloads = [...html.matchAll(/<link\b[^>]*>/g)]
    .filter((match) => match[0].match(/\brel="modulepreload"/) !== null)
    .map((match) => match[0].match(/\bhref="([^"]*)"/)?.[1])
    .filter((value) => value !== undefined);

  const stylesheets = [...html.matchAll(/<link\b[^>]*>/g)]
    .filter((match) => match[0].match(/\brel="stylesheet"/) !== null)
    .map((match) => match[0].match(/\bhref="([^"]*)"/)?.[1])
    .filter((value) => value !== undefined);

  const metrics = [
    {
      name: 'JS initial (gzip)',
      actual: await sumGzip([...scripts, ...preloads]),
      limit: budget.jsGzipBytes,
    },
    { name: 'CSS initial (gzip)', actual: await sumGzip(stylesheets), limit: budget.cssGzipBytes },
    { name: 'index.html', actual: Buffer.byteLength(html), limit: budget.indexHtmlBytes },
    { name: 'sw.js', actual: Buffer.byteLength(sw), limit: budget.serviceWorkerBytes },
    { name: 'precache total', actual: serviceWorker.precacheBytes, limit: budget.precacheBytes },
  ];

  console.log(`Precache entries: ${serviceWorker.entries}`);
  printBudget(metrics, budget.warnRatio);
}

await main();

if (failures.length > 0) {
  console.error('\nBuild audit failed:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log('\nBuild audit passed.');
