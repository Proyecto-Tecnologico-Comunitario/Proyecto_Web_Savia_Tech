// SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createVault, lockVault, unlockVault } from './helpers';

/** Texto del primer ítem, usado para comprobar que no queda en el DOM tras bloquear. */
const FIRST_ITEM = 'Me ha costado disfrutar de cosas que antes me gustaban.';

/** Crea un caso con consentimiento y espera al tamizaje. */
async function startCase(page: Page): Promise<void> {
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
async function answerAll(page: Page, option: string): Promise<void> {
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
async function saveScreening(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Detalle del caso' })).toBeVisible({
    timeout: 60_000,
  });
}

test.describe('case flows', () => {
  test('completes the flow without a safety alert', async ({ page }) => {
    await createVault(page);
    await startCase(page);
    await answerAll(page, 'Nunca');

    // Resultado con la banda mínima y sin alerta.
    await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible();
    await expect(page.getByText('Nivel calculado: Mínimo')).toBeVisible();

    await saveScreening(page);
    await expect(page.getByRole('heading', { name: 'Tamizajes' })).toBeVisible();
    await expect(page.getByText('Mínimo')).toBeVisible();
    await expect(page.getByText('Alerta de seguridad activada')).toHaveCount(0);

    // La ruta general conserva el orden del contenido: primero el servicio B.
    await page.getByRole('button', { name: 'Ver ruta de remisión' }).click();
    await expect(page.getByRole('heading', { name: 'Ruta de remisión' })).toBeVisible();
    await expect(page.getByText('Ruta prioritaria sugerida')).toHaveCount(0);

    const firstService = page.locator('.case-list-item').first();
    await expect(firstService).toContainText('Servicio de muestra B');
  });

  test('shows the safety alert and the priority route', async ({ page }) => {
    await createVault(page);
    await startCase(page);

    // Ocho respuestas bajas y el ítem de seguridad por encima del umbral.
    for (let question = 1; question <= 8; question += 1) {
      await expect(page.getByText(`Pregunta ${question} de 9`)).toBeVisible();
      await page.getByRole('radio', { name: 'Nunca', exact: true }).check();
      await page.getByRole('button', { name: 'Siguiente' }).click();
    }

    await expect(page.getByText('Pregunta 9 de 9')).toBeVisible();
    await page.getByRole('radio', { name: 'Algunos días', exact: true }).check();
    await page.getByRole('button', { name: 'Finalizar' }).click();

    // La alerta es la única salida y solo tiene "Entendido".
    const alert = page.locator('.safety-alert');
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('alert')).toBeVisible();
    await expect(alert.getByRole('button')).toHaveText('Entendido');
    await alert.getByRole('button', { name: 'Entendido' }).click();

    await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible();
    await saveScreening(page);
    await expect(page.getByText('Alerta de seguridad activada')).toBeVisible();

    // Con alerta, la ruta prioritaria va primero.
    await page.getByRole('button', { name: 'Ver ruta de remisión' }).click();
    await expect(page.getByText('Ruta prioritaria sugerida')).toBeVisible();

    const firstService = page.locator('.case-list-item').first();
    await expect(firstService).toContainText('Servicio de muestra A (prioritario)');
  });

  test('requires a justification to change the final band', async ({ page }) => {
    await createVault(page);
    await startCase(page);
    await answerAll(page, 'Nunca');

    await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible();
    await page.locator('#final-band').selectOption('severe');

    // El error y el botón deshabilitado bloquean el guardado hasta que haya justificación.
    await expect(page.getByText('Escribe una justificación para cambiar el nivel.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeDisabled();

    await page.locator('#justification').fill('La profesional valoró otros antecedentes.');
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    await saveScreening(page);
    await expect(page.getByText('Grave')).toBeVisible();
  });

  test('does not create a case without consent', async ({ page }) => {
    await createVault(page);
    await page.getByRole('button', { name: 'Nuevo caso' }).click();

    const continueButton = page.getByRole('button', { name: 'Continuar' });
    await expect(continueButton).toBeDisabled();

    await page.getByRole('button', { name: 'Atrás' }).click();
    await expect(page.getByText('Todavía no hay casos.')).toBeVisible();
  });

  test('discards answers when the vault locks mid-screening', async ({ page }) => {
    await createVault(page);
    await startCase(page);

    await page.getByRole('radio', { name: 'Nunca', exact: true }).check();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByText('Pregunta 2 de 9')).toBeVisible();

    await lockVault(page);
    await unlockVault(page);

    // El caso existe, pero el tamizaje en curso no se guardó.
    await page.getByRole('button', { name: /Abrir/ }).click();
    await expect(page.getByRole('heading', { name: 'Detalle del caso' })).toBeVisible();
    await expect(page.getByText('Este caso todavía no tiene tamizajes.')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(FIRST_ITEM);
  });

  test('quick exit leaves no case code or clinical text', async ({ page }) => {
    await createVault(page);
    await startCase(page);

    // El código seudónimo se muestra en la cabecera del tamizaje.
    const code = await page.locator('.case-code').first().innerText();
    await answerAll(page, 'Nunca');
    await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible();

    await page.getByRole('button', { name: 'Salida rápida' }).click();
    await expect(page.getByRole('heading', { name: 'Notas' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(code);
    await expect(page.locator('body')).not.toContainText('Cuestionario de bienestar');
  });

  test('switches language without losing answers', async ({ page }) => {
    await createVault(page);
    await startCase(page);

    await page.getByRole('radio', { name: 'Nunca', exact: true }).check();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByText('Pregunta 2 de 9')).toBeVisible();

    await page.getByRole('button', { name: 'Cambiar idioma' }).click();
    await expect(page.getByText('Question 2 of 9')).toBeVisible();
    await expect(page.getByText('I have felt down or without energy.')).toBeVisible();

    // La respuesta anterior sigue marcada al volver.
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('radio', { name: 'Never', exact: true })).toBeChecked();
  });
});
