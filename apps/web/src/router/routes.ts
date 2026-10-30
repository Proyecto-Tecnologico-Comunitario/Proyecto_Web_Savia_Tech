// SPDX-License-Identifier: GPL-3.0-or-later

/** Rutas disponibles en T5. T6 añadirá aquí las suyas. */
export type Route = { readonly name: 'home' } | { readonly name: 'settings' };

/** Ruta inicial. */
export const HOME_ROUTE: Route = { name: 'home' };

/** Ruta de ajustes. */
export const SETTINGS_ROUTE: Route = { name: 'settings' };
