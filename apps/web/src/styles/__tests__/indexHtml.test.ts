// SPDX-License-Identifier: GPL-3.0-or-later

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Ruta absoluta al HTML de entrada, independiente del directorio de ejecución.
const indexPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../index.html');
const html = readFileSync(indexPath, 'utf8');

/** Extrae los enlaces CSS en el orden en que el navegador los aplica. */
function stylesheetLinks(): string[] {
  return [...html.matchAll(/<link\b[^>]*\bhref="([^"]+\.css)"/g)].map((match) => match[1] ?? '');
}

/** Devuelve el contenido y el `media` de cada `<meta name="...">`. */
function metaTags(name: string): Array<{ content: string; media: string | undefined }> {
  return [...html.matchAll(/<meta\b[^>]*>/g)]
    .filter((match) => match[0].match(/\bname="([^"]+)"/)?.[1] === name)
    .map((match) => ({
      content: match[0].match(/\bcontent="([^"]*)"/)?.[1] ?? '',
      media: match[0].match(/\bmedia="([^"]*)"/)?.[1],
    }));
}

describe('index.html stylesheets', () => {
  it('links the source styles in cascade order', () => {
    // Vite inyecta los CSS importados como <style> en desarrollo; la CSP los bloquea.
    // Enlazarlos desde el HTML mantiene el mismo orden en desarrollo y en producción.
    expect(stylesheetLinks()).toEqual([
      '/src/styles/tokens.css',
      '/src/styles/base.css',
      '/src/styles/components.css',
    ]);
  });

  it('keeps the production CSP free of inline style allowances', () => {
    const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];

    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain("'unsafe-inline'");
  });
});

describe('index.html app metadata', () => {
  it('declares the SVG favicon', () => {
    expect(html).toMatch(/<link\b[^>]*\brel="icon"[^>]*\bhref="\/icons\/icon\.svg"/);
    expect(html).toMatch(/<link\b[^>]*\btype="image\/svg\+xml"/);
  });

  it('declares the Apple touch icon', () => {
    expect(html).toMatch(
      /<link\b[^>]*\brel="apple-touch-icon"[^>]*\bhref="\/icons\/apple-touch-icon\.png"/,
    );
  });

  it('declares a light and a dark theme color', () => {
    const themes = metaTags('theme-color');

    expect(themes.map((theme) => theme.content)).toEqual(['#ffffff', '#121212']);
    expect(themes[1]?.media).toBe('(prefers-color-scheme: dark)');
  });

  it('does not rely on inline scripts or styles', () => {
    // La CSP prohíbe todo lo inline; el HTML fuente tampoco debe introducirlo.
    expect(html).not.toMatch(/<script\b(?![^>]*\bsrc=)/);
    expect(html).not.toMatch(/<style\b/);
    expect(html).not.toMatch(/\bstyle\s*=/);
  });
});
