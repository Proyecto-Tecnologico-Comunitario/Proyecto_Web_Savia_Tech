// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from './fixtures';
import { createVault, expectUnlockScreen, openSettings, TEST_PIN, unlockVault } from './helpers';

test.describe('settings and language', () => {
  test('changes language without reloading and persists it', async ({ page }) => {
    // Se marca la ventana para detectar una recarga inesperada.
    await createVault(page);
    await page.evaluate(() => {
      (window as unknown as { __noReload?: boolean }).__noReload = true;
    });

    await openSettings(page);
    await page.getByRole('radio', { name: 'English' }).check();

    // El cambio es inmediato y actualiza el atributo `lang`.
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(
      await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload),
    ).toBe(true);

    // El idioma persiste tras recargar.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();
    await page.locator('#pin').fill(TEST_PIN);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible({ timeout: 60_000 });

    // Un valor inválido vuelve al idioma detectado (español) y al plazo por defecto.
    await page.evaluate(() => {
      localStorage.setItem('saviatech.settings', '{not valid json');
    });
    await page.reload();
    await expectUnlockScreen(page);
    await unlockVault(page);
    await openSettings(page);
    await expect(page.locator('#auto-lock')).toHaveValue('120000');
  });

  test('offers only 1, 2 and 5 minutes and rejects a manipulated value', async ({ page }) => {
    // El selector no debe ofrecer la opción de desactivar el bloqueo.
    await createVault(page);
    await openSettings(page);

    const options = page.locator('#auto-lock option');
    await expect(options).toHaveCount(3);
    await expect(options).toHaveText(['1 min', '2 min', '5 min']);

    const labels = (await options.allTextContents()).join(' ');
    expect(labels).not.toMatch(/nunca|never|desactiv|off/i);

    // Un tiempo fuera de la lista guardado a mano se ignora al leer.
    await page.evaluate(() => {
      localStorage.setItem(
        'saviatech.settings',
        JSON.stringify({ locale: 'es', autoLockMs: 45_000 }),
      );
    });
    await page.reload();
    await expectUnlockScreen(page);
    await unlockVault(page);
    await openSettings(page);
    await expect(page.locator('#auto-lock')).toHaveValue('120000');
  });

  test('warns when persistent storage is denied and shows the estimate', async ({ page }) => {
    // Se sustituye la API antes de cargar la app para simular una denegación.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: {
          persist: () => Promise.resolve(false),
          estimate: () => Promise.resolve({ usage: 1_572_864, quota: 10_485_760 }),
        },
      });
    });

    await createVault(page);

    // Inicio muestra el aviso discreto.
    await expect(page.getByText(/Este dispositivo podría borrar/)).toBeVisible();

    // Ajustes muestra el estado y el uso con un decimal.
    await openSettings(page);
    await expect(page.getByText(/No protegido contra borrado automático/)).toBeVisible();
    await expect(page.getByText(/1\.5 MB usados de 10\.0 MB/)).toBeVisible();
  });
});

test.describe('protected tree', () => {
  test('does not expose content while locked', async ({ page }) => {
    // Tras bloquear, el árbol protegido se desmonta y solo queda el PIN.
    await createVault(page);
    await page.getByRole('button', { name: 'Bloquear' }).click();
    await expectUnlockScreen(page);
    await expect(page.getByRole('heading', { name: 'Inicio' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salida rápida' })).toBeVisible();
  });
});
