// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Rutas de la aplicación.
 *
 * `caseId` es el identificador aleatorio de la fila, nunca el código seudónimo ni un dato clínico.
 * Vive solo en memoria: la URL no cambia (ADR-0006).
 */
export type Route =
  | { readonly name: 'home' }
  | { readonly name: 'settings' }
  | { readonly name: 'new-case' }
  | { readonly name: 'case-detail'; readonly caseId: string }
  | { readonly name: 'screening'; readonly caseId: string }
  | { readonly name: 'referral'; readonly caseId: string };

/** Ruta inicial: lista de casos. */
export const HOME_ROUTE: Route = { name: 'home' };

/** Ruta de ajustes. */
export const SETTINGS_ROUTE: Route = { name: 'settings' };

/** Ruta de nuevo caso y consentimiento. */
export const NEW_CASE_ROUTE: Route = { name: 'new-case' };

/** Ruta del detalle de un caso concreto. */
export function caseDetailRoute(caseId: string): Route {
  return { name: 'case-detail', caseId };
}

/** Ruta del tamizaje de un caso concreto. */
export function screeningRoute(caseId: string): Route {
  return { name: 'screening', caseId };
}

/** Ruta de remisión de un caso concreto. */
export function referralRoute(caseId: string): Route {
  return { name: 'referral', caseId };
}
