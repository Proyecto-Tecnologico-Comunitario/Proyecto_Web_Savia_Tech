// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from './fixtures';
import { createVault, openSettings } from './helpers';

test.describe('content security policy', () => {
  test('applies the external stylesheet', async ({ page }) => {
    await page.goto('/');

    // Si la hoja no se carga, el navegador vuelve a `display: block` y a la fuente Times.
    await expect(page.locator('main')).toBeVisible();
    const mainStyle = await page.locator('main').evaluate((element) => {
      const style = getComputedStyle(element);
      return { display: style.display, fontFamily: style.fontFamily };
    });

    expect(mainStyle.display).toBe('flex');
    expect(mainStyle.fontFamily).not.toContain('Times New Roman');

    const stylesheets = await page.evaluate(() =>
      [...document.styleSheets].map((sheet) => sheet.href),
    );
    expect(stylesheets.some((href) => href?.includes('/assets/'))).toBe(true);
  });

  test('has no inline styles, inline scripts or CSP violations', async ({ page }) => {
    // Se recorren las pantallas principales para cubrir también los componentes montados tarde.
    await createVault(page);

    // Ningún atributo `style` ni bloque `<style>` puede existir.
    await expect(page.locator('[style]')).toHaveCount(0);
    await expect(page.locator('style')).toHaveCount(0);

    // Los scripts deben ser módulos externos; no se permite código en línea.
    await expect(page.locator('script:not([src])')).toHaveCount(0);

    await openSettings(page);
    await expect(page.locator('[style]')).toHaveCount(0);
    await expect(page.locator('style')).toHaveCount(0);

    // El fixture comprueba al terminar que no hubo violaciones, errores ni peticiones externas.
  });
});
