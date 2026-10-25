// SPDX-License-Identifier: GPL-3.0-or-later
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

// Elementos de la raíz para para la manipulación del DOM
const rootElement = document.getElementById('root');

// Condicionales para los elementos de la raíz
if (!rootElement) {
  throw new Error('Missing #root element');
}

// Creación del renderizado de los elementos de la raíz
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
