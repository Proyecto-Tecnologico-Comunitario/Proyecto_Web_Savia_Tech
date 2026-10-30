// SPDX-License-Identifier: GPL-3.0-or-later

import { test } from './fixtures';
import {
  createVault,
  expectHome,
  expectUnlockScreen,
  lockVault,
  openSettings,
  TEST_PIN,
  unlockVault,
} from './helpers';

test.describe('automatic lock', () => {
  test('locks after the default deadline and activity resets it', async ({ page }) => {
    // El reloj falso evita esperar dos minutos reales.
    await page.clock.install();
    await createVault(page);

    // Sin actividad, el plazo por defecto (2 min) bloquea.
    await page.clock.fastForward(121_000);
    await expectUnlockScreen(page);

    // Tras desbloquear, una actividad intermedia reinicia la cuenta.
    await unlockVault(page);
    await page.clock.fastForward(90_000);
    await page.mouse.click(5, 5);
    await page.clock.fastForward(60_000);
    await expectHome(page);

    // Al superar el plazo completo desde la última actividad, bloquea.
    await page.clock.fastForward(61_000);
    await expectUnlockScreen(page);
  });

  test('uses the one-minute option chosen in settings', async ({ page }) => {
    // El plazo se cambia desde Ajustes y debe aplicarse al temporizador vigente.
    await page.clock.install();
    await createVault(page);
    await openSettings(page);
    await page.locator('#auto-lock').selectOption('60000');

    // 61 s superan el nuevo plazo.
    await page.clock.fastForward(61_000);
    await expectUnlockScreen(page);
  });

  test('locks immediately when the page becomes hidden or is left', async ({ page }) => {
    // La página oculta bloquea sin esperar al plazo.
    await createVault(page);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expectUnlockScreen(page);

    // `pagehide` también bloquea de inmediato.
    await unlockVault(page);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await expectUnlockScreen(page);
  });

  test('the lock button blocks and resets navigation', async ({ page }) => {
    // Bloquear desde Ajustes debe volver a Inicio al desbloquear de nuevo.
    await createVault(page);
    await openSettings(page);
    await lockVault(page);

    // El PIN desbloquea en Inicio, no en la pantalla anterior.
    await page.locator('#pin').fill(TEST_PIN);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expectHome(page);
  });
});
