// SPDX-License-Identifier: GPL-3.0-or-later

import type { CDPSession, Page } from '@playwright/test';

import { test } from './fixtures';
import { expectSetupScreen } from './helpers';
import { warmOfflineCache } from './pwa';

/** Perfil Slow 4G: 150 ms de latencia y 1,6/0,75 Mbps. */
const SLOW_4G = {
  offline: false,
  latency: 150,
  downloadThroughput: 1_600_000 / 8,
  uploadThroughput: 750_000 / 8,
};

/** Aplica el límite de CPU y de red indicados a la sesión CDP. */
async function throttle(session: CDPSession, cpu: number): Promise<void> {
  await session.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await session.send('Network.emulateNetworkConditions', SLOW_4G);
}

/** Mide el tiempo hasta ver la pantalla de PIN; excluye PBKDF2. */
async function measureUntilPin(page: Page, navigate: () => Promise<unknown>): Promise<number> {
  const started = Date.now();
  const navigation = navigate();

  await expectSetupScreen(page);
  const elapsed = Date.now() - started;

  // Se espera la navegación completa para no dejar promesas pendientes.
  await navigation;

  return elapsed;
}

// Solo se ejecuta con `PERF=1`; `playwright.config.ts` ignora el archivo en el resto de casos.
for (const cpu of [4, 6]) {
  test(`cold first load, CPU ${cpu}x, Slow 4G`, async ({ page, context }) => {
    const session = await context.newCDPSession(page);
    await throttle(session, cpu);

    const elapsed = await measureUntilPin(page, () => page.goto('/'));

    test.info().annotations.push({
      type: 'perf',
      description: `cold first load, CPU ${cpu}x, Slow 4G: ${elapsed} ms`,
    });
  });

  test(`service worker load, CPU ${cpu}x, Slow 4G`, async ({ page, context }) => {
    // Se calienta el precaché sin límites para medir la carga servida por el worker.
    await warmOfflineCache(page);

    const session = await context.newCDPSession(page);
    await throttle(session, cpu);

    const elapsed = await measureUntilPin(page, () => page.reload());

    test.info().annotations.push({
      type: 'perf',
      description: `service worker load, CPU ${cpu}x, Slow 4G: ${elapsed} ms`,
    });
  });
}
