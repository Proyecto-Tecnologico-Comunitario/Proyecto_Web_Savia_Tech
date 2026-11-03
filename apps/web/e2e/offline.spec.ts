// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from './fixtures';
import { answerAll, saveScreening, startCase } from './caseFlowSteps';
import {
  createVault,
  expectHome,
  expectSetupScreen,
  expectUnlockScreen,
  lockVault,
  TEST_PIN,
  unlockVault,
} from './helpers';
import {
  goOffline,
  PWA_BASE_URL,
  precachePath,
  readBuildPrecacheUrls,
  readCacheAudit,
  warmOfflineCache,
} from './pwa';

test.describe('offline', () => {
  test('O1 registers the service worker and precaches the build', async ({ page }) => {
    await warmOfflineCache(page);

    // El worker queda activo y controlando la página tras la recarga.
    const registration = await page.evaluate(async () => {
      const ready = await navigator.serviceWorker.ready;

      return {
        active: ready.active?.state ?? null,
        controlled: navigator.serviceWorker.controller !== null,
        script: ready.active?.scriptURL ?? null,
      };
    });

    expect(registration.active).toBe('activated');
    expect(registration.controlled).toBe(true);
    expect(registration.script).toContain('/sw.js');

    // La caché de Workbox contiene todos los archivos declarados en el build.
    const urls = await readBuildPrecacheUrls();
    const audit = await readCacheAudit(page);

    expect(audit.keys.length).toBeGreaterThan(0);
    expect(audit.keys.every((key) => key.startsWith('workbox-precache'))).toBe(true);

    const cached = new Set(audit.urls.map((url) => new URL(url).pathname));
    for (const url of urls) {
      expect(cached.has(precachePath(url)), `missing ${url}`).toBe(true);
    }
  });

  test('O2 starts cold without network and shows the unlock screen', async ({ page, context }) => {
    await warmOfflineCache(page);
    await createVault(page);
    await lockVault(page);

    await goOffline(context);
    await page.reload();

    // La navegación se sirve desde el precaché y la bóveda sigue bloqueada.
    await expectUnlockScreen(page);
  });

  test('O3 completes the whole flow without network', async ({ page, context }) => {
    await warmOfflineCache(page);
    await createVault(page);
    await lockVault(page);

    await goOffline(context);
    await unlockVault(page);

    // Ocho respuestas bajas y el ítem de seguridad por encima del umbral.
    await startCase(page);
    for (let question = 1; question <= 8; question += 1) {
      await expect(page.getByText(`Pregunta ${question} de 9`)).toBeVisible();
      await page.getByRole('radio', { name: 'Nunca', exact: true }).check();
      await page.getByRole('button', { name: 'Siguiente' }).click();
    }

    await expect(page.getByText('Pregunta 9 de 9')).toBeVisible();
    await page.getByRole('radio', { name: 'Algunos días', exact: true }).check();
    await page.getByRole('button', { name: 'Finalizar' }).click();

    // La alerta de seguridad es la única salida.
    await page.getByRole('button', { name: 'Entendido' }).click();
    await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible();

    // Se cambia la banda con justificación y se guarda el tamizaje.
    await page.locator('#final-band').selectOption('severe');
    await page.locator('#justification').fill('La profesional valoró otros antecedentes.');
    await saveScreening(page);

    // La ruta prioritaria se calcula y se muestra sin red.
    await page.getByRole('button', { name: 'Ver ruta de remisión' }).click();
    await expect(page.getByRole('heading', { name: 'Ruta de remisión' })).toBeVisible();
    await expect(page.getByText('Ruta prioritaria sugerida')).toBeVisible();

    // La salida rápida no deja texto clínico y el acceso posterior pide el PIN.
    await page.getByRole('button', { name: 'Salida rápida' }).click();
    await expect(page.getByRole('heading', { name: 'Notas' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Cuestionario de bienestar');
    await expect(page.locator('body')).not.toContainText('SaviaTech');

    await page.getByRole('button', { name: 'Abrir' }).click();
    await expectUnlockScreen(page);
  });

  test('O4 is usable on a first visit without network', async ({ page, context }) => {
    // Se instala el precaché antes de cortar la red, sin crear todavía la bóveda.
    await warmOfflineCache(page);
    await goOffline(context);
    await page.reload();

    await expectSetupScreen(page);
    await page.locator('#pin').fill(TEST_PIN);
    await page.locator('#pin-confirmation').fill(TEST_PIN);
    await page.getByRole('button', { name: 'Crear PIN' }).click();

    await expectHome(page);
  });

  test('O5 keeps case data out of the caches and web storage', async ({ page }) => {
    await warmOfflineCache(page);
    await createVault(page);
    await startCase(page);

    // El código seudónimo y la justificación son datos de la usuaria.
    const code = (await page.locator('.case-code').first().innerText()).trim();
    const justification = 'JUSTIFICACION-SINTETICA-O5';

    await answerAll(page, 'Nunca');
    await page.locator('#final-band').selectOption('severe');
    await page.locator('#justification').fill(justification);
    await saveScreening(page);

    const audit = await readCacheAudit(page);
    const buildUrls = new Set((await readBuildPrecacheUrls()).map(precachePath));

    // Solo existe la caché del precaché y solo contiene archivos del build.
    expect(audit.keys.length).toBeGreaterThan(0);
    expect(audit.keys.every((key) => key.startsWith('workbox-precache'))).toBe(true);

    for (const url of audit.urls) {
      const parsed = new URL(url);
      expect(parsed.origin).toBe(PWA_BASE_URL);
      expect(buildUrls.has(parsed.pathname), `unexpected cached URL ${url}`).toBe(true);
    }

    // Ninguna respuesta cacheada contiene el código, el PIN ni la justificación.
    const cachedText = audit.texts.join('\n');
    expect(cachedText).not.toContain(code);
    expect(cachedText).not.toContain(TEST_PIN);
    expect(cachedText).not.toContain(justification);

    // El almacenamiento web solo conserva los ajustes no sensibles; si no se cambió ninguno,
    // `localStorage` puede estar vacío.
    const storage = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));

    expect(storage.local.filter((key) => key !== 'saviatech.settings')).toEqual([]);
    expect(storage.session).toEqual([]);
  });
});
