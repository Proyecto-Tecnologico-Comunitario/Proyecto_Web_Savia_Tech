// SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import {
  createVault,
  expectUnlockScreen,
  lockVault,
  openSettings,
  TEST_PIN,
  unlockVault,
} from './helpers';

/** Comprueba la pantalla neutral y que no quede contenido sensible. */
async function expectNeutral(page: Page): Promise<void> {
  // El título neutral es lo único que debe quedar.
  await expect(page.getByRole('heading', { name: 'Notas' })).toBeVisible();
  await expect(page).toHaveTitle('Notas');
  await expect(page.locator('body')).not.toContainText('SaviaTech');
  await expect(page.locator('body')).not.toContainText('Inicio');
  await expect(page.locator('body')).not.toContainText('Ajustes');
  await expect(page.getByRole('button', { name: 'Salida rápida' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cambiar idioma' })).toHaveCount(0);
}

test.describe('quick exit', () => {
  test('reaches the neutral screen from home, settings and the PIN screen', async ({ page }) => {
    // Desde Inicio.
    await createVault(page);
    await page.getByRole('button', { name: 'Salida rápida' }).click();
    await expectNeutral(page);

    // Recargar desde la pantalla neutral también lleva al PIN, nunca a Inicio.
    await page.reload();
    await expectUnlockScreen(page);

    // Abrir vuelve al PIN, nunca a contenido protegido.
    await unlockVault(page);
    await page.getByRole('button', { name: 'Salida rápida' }).click();
    await expectNeutral(page);
    await page.getByRole('button', { name: 'Abrir' }).click();
    await expectUnlockScreen(page);

    // Recargar sigue llevando al PIN.
    await page.reload();
    await expectUnlockScreen(page);

    // Desde Ajustes.
    await unlockVault(page);
    await openSettings(page);
    await page.getByRole('button', { name: 'Salida rápida' }).click();
    await expectNeutral(page);
    await page.getByRole('button', { name: 'Abrir' }).click();
    await expectUnlockScreen(page);

    // Desde la propia pantalla de PIN.
    await page.getByRole('button', { name: 'Salida rápida' }).click();
    await expectNeutral(page);
  });

  test('does not unlock when pressed during an unlock in progress', async ({ page }) => {
    // Se bloquea para tener la pantalla de desbloqueo.
    await createVault(page);
    await lockVault(page);

    // Ambos clics se disparan en la misma tarea: la salida rápida bloquea antes de que termine PBKDF2.
    await page.evaluate((pin) => {
      const buttons = [...document.querySelectorAll('button')];
      const submit = buttons.find((button) => button.textContent?.trim() === 'Entrar');
      const quickExit = buttons.find((button) => button.textContent?.trim() === 'Salida rápida');

      const input = document.querySelector<HTMLInputElement>('#pin');

      if (input !== null) {
        input.value = pin;
      }

      submit?.click();
      quickExit?.click();
    }, TEST_PIN);

    // La pantalla neutral gana y no aparece ningún error.
    await expectNeutral(page);
    await page.waitForTimeout(2_000);
    await expectNeutral(page);
    await expect(page.getByText('PIN incorrecto.')).toHaveCount(0);
    await expect(page.getByText(/No se pudo completar/)).toHaveCount(0);

    // Abrir lleva al PIN: la bóveda no quedó desbloqueada.
    await page.getByRole('button', { name: 'Abrir' }).click();
    await expectUnlockScreen(page);
    await expect(page.getByRole('heading', { name: 'Inicio' })).toHaveCount(0);
  });
});
