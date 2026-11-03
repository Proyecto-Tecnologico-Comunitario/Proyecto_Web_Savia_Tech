/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
// SPDX-License-Identifier: GPL-3.0-or-later

// Variables de entorno expuestas al cliente; todas se validan en `vite.config.ts`.
interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_SHORT_NAME?: string;
  readonly VITE_BASE_PATH?: string;
}

// Creación de la interfaz para importar los elementos del DOM
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
