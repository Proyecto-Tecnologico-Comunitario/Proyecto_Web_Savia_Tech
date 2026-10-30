// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from './fixtures';
import {
  createVault,
  expectHome,
  expectNoPinTrace,
  expectSetupScreen,
  expectUnlockScreen,
  lockVault,
  TEST_PIN,
} from './helpers';

test.describe('PIN screens', () => {
  test('validates setup locally, then creates the vault', async ({ page }) => {
    // La primera visita muestra la configuración, no Inicio.
    await page.goto('/');
    await expectSetupScreen(page);

    // Un PIN demasiado corto se rechaza sin llamar al KDF.
    await page.locator('#pin').fill('123');
    await page.locator('#pin-confirmation').fill('123');
    await page.getByRole('button', { name: 'Crear PIN' }).click();
    await expect(page.getByRole('alert')).toContainText('al menos 6');
    await expectNoPinTrace(page);

    // Un PIN con letras también se rechaza.
    await page.locator('#pin').fill('12345a');
    await page.locator('#pin-confirmation').fill('12345a');
    await page.getByRole('button', { name: 'Crear PIN' }).click();
    await expect(page.getByRole('alert')).toContainText('solo números');
    await expectNoPinTrace(page);

    // La confirmación debe coincidir.
    await page.locator('#pin').fill(TEST_PIN);
    await page.locator('#pin-confirmation').fill('000000');
    await page.getByRole('button', { name: 'Crear PIN' }).click();
    await expect(page.getByRole('alert')).toContainText('no coinciden');
    await expectNoPinTrace(page);

    // Con un PIN válido se crea la bóveda y se entra a Inicio.
    await page.locator('#pin').fill(TEST_PIN);
    await page.locator('#pin-confirmation').fill(TEST_PIN);
    await page.getByRole('button', { name: 'Crear PIN' }).click();
    await expectHome(page);
    await expectNoPinTrace(page);
  });

  test('reload shows unlock, rejects a wrong PIN and accepts the right one', async ({ page }) => {
    // Se crea la bóveda y se recarga para comprobar que no se recuerda la sesión.
    await createVault(page);
    await page.reload();
    await expectUnlockScreen(page);
    await expect(page.getByRole('heading', { name: 'Inicio' })).toHaveCount(0);

    // Un PIN incorrecto produce el mensaje genérico y vacía el campo.
    await page.locator('#pin').fill('000000');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('PIN incorrecto.')).toBeVisible();
    await expectNoPinTrace(page);

    // El PIN correcto desbloquea.
    await page.locator('#pin').fill(TEST_PIN);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expectHome(page);
  });

  test('shows a countdown after repeated failures and enables the button at zero', async ({
    page,
  }) => {
    // El reloj falso permite avanzar la cuenta atrás sin esperar en tiempo real.
    await page.clock.install();
    await createVault(page);
    await lockVault(page);

    // Se agotan los intentos; el número exacto puede variar según la política del llavero.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await page.locator('#pin').fill('000000');
      await page.getByRole('button', { name: 'Entrar' }).click();

      // El mensaje de espera aparece dos veces (visual y solo para lectores); se usa el primero.
      const waitMessage = page.getByText(/Demasiados intentos/).first();
      const incorrectMessage = page.getByText('PIN incorrecto.');

      await expect(waitMessage.or(incorrectMessage)).toBeVisible();

      if ((await waitMessage.count()) > 0) {
        break;
      }

      await expect(incorrectMessage).toBeVisible();
      await expectNoPinTrace(page);
    }

    // La espera deja el botón deshabilitado y muestra segundos.
    await expect(page.getByText(/Demasiados intentos/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeDisabled();
    await expectNoPinTrace(page);

    // Al cumplirse el plazo, el botón vuelve a estar disponible.
    await page.clock.fastForward(31_000);
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });
});
