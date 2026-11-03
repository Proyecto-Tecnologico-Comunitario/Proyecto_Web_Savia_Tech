// SPDX-License-Identifier: GPL-3.0-or-later

import type { SwCallbacks, SwRegistration } from './swStatus';

/**
 * Registra el service worker generado por el build.
 *
 * No hay efectos al importar: el módulo virtual solo se carga cuando de verdad se registra.
 */
export async function registerServiceWorker(callbacks: SwCallbacks): Promise<SwRegistration> {
  // En desarrollo y en pruebas no se registra nada; el service worker se verifica con build + preview.
  if (
    !import.meta.env.PROD ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return { update: async () => undefined };
  }

  // Import dinámico: `workbox-window` viaja en su propio fragmento y no retrasa el arranque.
  const { registerSW } = await import('virtual:pwa-register');

  const update = registerSW({
    immediate: false,
    onOfflineReady: callbacks.onOfflineReady,
    onNeedRefresh: callbacks.onNeedRefresh,
    onRegisteredSW: () => callbacks.onRegistered(),
    // El error se recibe como `unknown` y nunca se imprime ni se muestra.
    onRegisterError: (error: unknown) => callbacks.onError(error),
  });

  return { update };
}
