// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Salida rápida.
 *
 * El orden es crítico: bloquear primero y neutralizar la pantalla después. Cada paso va en su propio
 * `try` para que un fallo no omita los siguientes; el bloqueo es el paso que nunca se omite.
 */
export interface QuickExitDeps {
  /** Bloquea la bóveda y descarta el estado volátil. */
  readonly lock: () => void;
  /** Cambia a la pantalla neutral. */
  readonly showNeutral: () => void;
  /** Reemplaza la entrada de historial actual para que Atrás no vuelva a una pantalla sensible. */
  readonly replaceHistory: () => void;
  /** Pone el título neutral localizado. */
  readonly setTitle: () => void;
}

/** Crea la acción de salida rápida. */
export function createQuickExit(deps: QuickExitDeps): () => void {
  return () => {
    // 1. Bloquear es obligatorio y va primero.
    try {
      deps.lock();
    } catch {
      // El bloqueo del llavero no debería fallar; si falla, se continúa para neutralizar la pantalla.
    }

    // 2. Mostrar la pantalla neutral antes de tocar el historial.
    try {
      deps.showNeutral();
    } catch {
      // Un fallo del router no impide reemplazar el historial ni el título.
    }

    // 3. Reemplazar la entrada actual; es «best effort» según el navegador.
    try {
      deps.replaceHistory();
    } catch {
      // Algunos navegadores restringen el historial; no se rompe la salida rápida.
    }

    // 4. Poner el título neutral para que el conmutador de apps no muestre el nombre de la app.
    try {
      deps.setTitle();
    } catch {
      // Un fallo al cambiar el título no debe dejar la app bloqueada a medias.
    }
  };
}
