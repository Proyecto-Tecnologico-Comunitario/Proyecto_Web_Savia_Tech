// SPDX-License-Identifier: GPL-3.0-or-later

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { createApp } from './app/createApp';

// Elemento raíz de la aplicación.
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing #root element');
}

// La raíz de composición se crea una sola vez, fuera del ciclo de render de React.
const app = createApp();

createRoot(rootElement).render(
  <StrictMode>
    <App app={app} />
  </StrictMode>,
);
