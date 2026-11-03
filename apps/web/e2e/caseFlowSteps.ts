// SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test';

import { expect } from './fixtures';

/** Crea un caso con consentimiento y espera al tamizaje. */
export async function startCase(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Nuevo caso' }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo caso' })).toBeVisible();

  // Sin la casilla marcada no se puede continuar.
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // La cabecera del tamizaje muestra el instrumento de muestra.
  await expect(
    page.getByRole('heading', { name: 'Cuestionario de bienestar (muestra)' }),
  ).toBeVisible({ timeout: 60_000 });
}

/** Responde todas las preguntas con la misma opción y finaliza. */
export async function answerAll(page: Page, option: string): Promise<void> {
  for (let question = 1; question <= 9; question += 1) {
    await expect(page.getByText(`Pregunta ${question} de 9`)).toBeVisible();
    await page.getByRole('radio', { name: option, exact: true }).check();

    if (question < 9) {
      await page.getByRole('button', { name: 'Siguiente' }).click();
    } else {
      await page.getByRole('button', { name: 'Finalizar' }).click();
    }
  }
}

/** Guarda el tamizaje y espera al detalle del caso. */
export async function saveScreening(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Detalle del caso' })).toBeVisible({
    timeout: 60_000,
  });
}
