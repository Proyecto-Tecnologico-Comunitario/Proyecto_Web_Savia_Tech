// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Estado de la solicitud de almacenamiento persistente.
 *
 * `unsupported` indica que el navegador no expone la API; `denied` que la API existe pero no concedió
 * la persistencia. La interfaz mostrará la advertencia correspondiente en T5/T6.
 */
export type PersistenceStatus = 'granted' | 'denied' | 'unsupported';

/** Resultado de la estimación de espacio, en bytes. */
export interface StorageEstimateResult {
  usage: number;
  quota: number;
}

/**
 * Solicita al navegador que no desaloje IndexedDB por falta de espacio.
 *
 * No se llama al importar el módulo: la app decide cuándo pedirlo. Si la API no existe, se informa
 * `unsupported`; si la solicitud falla o se deniega, se informa `denied` para que la UI pueda avisar.
 */
export async function requestPersistentStorage(): Promise<PersistenceStatus> {
  // `navigator` puede no existir en pruebas o en contextos muy restringidos.
  const storage = globalThis.navigator?.storage;

  // Un navegador sin la API no puede conceder persistencia.
  if (typeof storage?.persist !== 'function') {
    return 'unsupported';
  }

  try {
    // El navegador decide según espacio, uso e instalación; no se puede forzar.
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    // Un fallo de la API no debe romper el arranque; se trata como persistencia denegada.
    return 'denied';
  }
}

/**
 * Estima el uso y la cuota de almacenamiento disponibles.
 *
 * Devuelve `null` cuando la API no existe, falla o no entrega cifras válidas. La estimación es
 * aproximada y nunca se usa para tomar decisiones clínicas.
 */
export async function estimateStorage(): Promise<StorageEstimateResult | null> {
  // La API es opcional y puede faltar en navegadores antiguos.
  const storage = globalThis.navigator?.storage;

  // Sin `estimate` no hay cifras que mostrar.
  if (typeof storage?.estimate !== 'function') {
    return null;
  }

  try {
    // El navegador puede devolver campos opcionales.
    const estimate = await storage.estimate();
    const usage = estimate.usage;
    const quota = estimate.quota;

    // Solo se devuelven cifras finitas y no negativas.
    if (
      typeof usage !== 'number' ||
      typeof quota !== 'number' ||
      !Number.isFinite(usage) ||
      !Number.isFinite(quota) ||
      usage < 0 ||
      quota < 0
    ) {
      return null;
    }

    return { usage, quota };
  } catch {
    // Un fallo de estimación no debe impedir usar la app.
    return null;
  }
}
