// SPDX-License-Identifier: GPL-3.0-or-later

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { createApp } from './app/createApp';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { createSwStatus } from './pwa/swStatus';

// Elemento raíz de la aplicación.
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing #root element');
}

// La raíz de composición se crea una sola vez, fuera del ciclo de render de React.
const app = createApp();

// El estado del service worker no toca el DOM; recibe sus dependencias desde aquí.
const swStatus = createSwStatus({
  isSupported: () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  register: registerServiceWorker,
  // Aplicar una actualización con la bóveda abierta perdería el trabajo en curso.
  isVaultUnlocked: () => app.keyring.getState() === 'unlocked',
});

createRoot(rootElement).render(
  <StrictMode>
    <App app={app} swStatus={swStatus} />
  </StrictMode>,
);

/** Arranca el registro sin competir con el primer render. */
const startServiceWorker = (): void => {
  void swStatus.start();
};

// Si el documento ya terminó de cargar, se registra de inmediato; si no, se espera al evento `load`.
if (document.readyState === 'complete') {
  startServiceWorker();
} else {
  window.addEventListener('load', startServiceWorker, { once: true });
}
