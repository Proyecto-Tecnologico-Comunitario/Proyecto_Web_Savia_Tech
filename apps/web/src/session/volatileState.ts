// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Registro de estado volátil que debe descartarse en cada bloqueo.
 *
 * T6 registrará aquí el caso en curso (respuestas, consentimiento sin guardar, etc.). T5 solo
 * construye el mecanismo y lo prueba con dobles.
 */
export interface VolatileStateRegistry {
  /** Registra una función de limpieza y devuelve la forma de anular el registro. */
  register(clear: () => void): () => void;
  /** Ejecuta todas las limpiezas; si una falla, continúa con las demás. */
  clearAll(): void;
}

/** Crea un registro aislado de estado volátil. */
export function createVolatileStateRegistry(): VolatileStateRegistry {
  // Se guardan funciones, no datos: el registro no conoce el estado de los casos.
  const cleaners = new Set<() => void>();

  return {
    register(clear) {
      // Se añade la limpieza al conjunto.
      cleaners.add(clear);

      // La anulación es idempotente y no falla si se llama dos veces.
      let active = true;
      return () => {
        if (!active) {
          return;
        }

        active = false;
        cleaners.delete(clear);
      };
    },

    clearAll() {
      // Se recorre una copia para que una limpieza pueda anular su propio registro sin alterar el bucle.
      for (const clear of [...cleaners]) {
        try {
          clear();
        } catch {
          // Una limpieza defectuosa no debe impedir que se descarten las demás.
        }
      }
    },
  };
}
