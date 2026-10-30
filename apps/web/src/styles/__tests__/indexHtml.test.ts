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
