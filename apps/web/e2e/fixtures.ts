// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test as base } from '@playwright/test';

/** Origen servido por `vite preview`; cualquier otro origen es una fuga de red. */
const ORIGIN = 'http://127.0.0.1:4173';

/**
 * Fixture común a todas las pruebas.
 *
 * Además de aislar cada contexto, vigila la CSP, los errores de consola y las peticiones externas. Una
 * violación o una petición a otro origen hace fallar la prueba aunque la aserción principal pase.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Se recogen los fallos que no son aserciones de la prueba.
    const cspViolations: string[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const externalRequests: string[] = [];

    // El binding permite que el evento del navegador llegue al proceso de Playwright.
    await page.exposeFunction('__reportCspViolation', (violation: string) => {
      cspViolations.push(violation);
    });

    // El listener se instala antes de cualquier script de la página para no perder violaciones.
    await page.addInitScript(() => {
      window.addEventListener('securitypolicyviolation', (event) => {
        const report = (window as unknown as { __reportCspViolation?: (value: string) => void })
          .__reportCspViolation;
        report?.(`${event.violatedDirective} ${event.blockedURI}`);
      });
    });

    // Los errores de consola y las excepciones no controladas también son fallos de la prueba.
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    // Ninguna petición puede salir del origen local, salvo datos embebidos.
    page.on('request', (request) => {
      const url = new URL(request.url());

      if (url.origin !== ORIGIN && url.protocol !== 'data:' && url.protocol !== 'blob:') {
        externalRequests.push(url.href);
      }
    });

    await use(page);

    // Se usan aserciones suaves para reportar todos los problemas juntos.
    expect.soft(cspViolations, 'CSP violations').toEqual([]);
    expect.soft(consoleErrors, 'console errors').toEqual([]);
    expect.soft(pageErrors, 'uncaught page errors').toEqual([]);
    expect.soft(externalRequests, 'external requests').toEqual([]);
  },
});

export { expect };
