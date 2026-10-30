// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, type Page } from '@playwright/test';

/** PIN sintético usado por las pruebas; nunca es un dato real. */
export const TEST_PIN = '135790';

/** Espera a que la compuerta muestre la pantalla de creación del PIN. */
export async function expectSetupScreen(page: Page): Promise<void> {
  // El título identifica la pantalla sin depender de la URL.
  await expect(page.getByRole('heading', { name: 'Crea un PIN' })).toBeVisible();
}

/** Espera a que la compuerta muestre la pantalla de desbloqueo. */
export async function expectUnlockScreen(page: Page): Promise<void> {
  // La pantalla de PIN es la única que muestra este título.
  await expect(page.getByRole('heading', { name: 'Ingresa tu PIN' })).toBeVisible();
}

/** Espera a que el árbol protegido muestre Inicio. */
export async function expectHome(page: Page): Promise<void> {
  // Inicio solo se monta con la bóveda desbloqueada.
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 60_000 });
}

/** Crea una bóveda nueva con el PIN sintético y espera a Inicio. */
export async function createVault(page: Page): Promise<void> {
  // La primera visita siempre parte de la configuración del PIN.
  await page.goto('/');
  await expectSetupScreen(page);

  // Se rellenan ambos campos y se envía el formulario.
  await page.locator('#pin').fill(TEST_PIN);
  await page.locator('#pin-confirmation').fill(TEST_PIN);
  await page.getByRole('button', { name: 'Crear PIN' }).click();

  // PBKDF2 con las iteraciones de producción puede tardar varios segundos.
  await expectHome(page);
}

/** Desbloquea una bóveda existente y espera a Inicio. */
export async function unlockVault(page: Page): Promise<void> {
  // La pantalla de desbloqueo tiene un único campo.
  await expectUnlockScreen(page);
  await page.locator('#pin').fill(TEST_PIN);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expectHome(page);
}

/** Bloquea la bóveda desde el encabezado y espera al PIN. */
export async function lockVault(page: Page): Promise<void> {
  // El botón de bloqueo está en el encabezado de las pantallas desbloqueadas.
  await page.getByRole('button', { name: 'Bloquear' }).click();
  await expectUnlockScreen(page);
}

/** Abre Ajustes desde el encabezado. */
export async function openSettings(page: Page): Promise<void> {
  // Se usa el botón del encabezado, no el título de la pantalla.
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
}

/** Comprueba que no queda ningún rastro del PIN en el DOM, la URL ni el almacenamiento. */
export async function expectNoPinTrace(page: Page): Promise<void> {
  // Si sigue habiendo campos de PIN, todos deben estar vacíos.
  const pinInputs = page.locator('input[type="password"]');
  const count = await pinInputs.count();

  for (let index = 0; index < count; index += 1) {
    await expect(pinInputs.nth(index)).toHaveValue('');
  }

  // Tampoco en el texto visible, la URL ni los almacenes del navegador.
  await expect(page.locator('body')).not.toContainText(TEST_PIN);
  expect(page.url()).not.toContain(TEST_PIN);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(TEST_PIN);
  expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain(TEST_PIN);
}
