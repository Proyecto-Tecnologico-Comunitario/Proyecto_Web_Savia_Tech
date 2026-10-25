/// <reference types="vite/client" />
// SPDX-License-Identifier: GPL-3.0-or-later

// Creación de la interfaz para importar VITE
interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
}

//  Creación de la interfaz para importar los elementos del DOM
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
