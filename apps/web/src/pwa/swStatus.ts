// SPDX-License-Identifier: GPL-3.0-or-later

/** Estado observable del service worker. */
export type ServiceWorkerStatus =
  'unsupported' | 'registering' | 'offlineReady' | 'updateAvailable' | 'error';

/** Resultado de intentar aplicar una actualización. */
export type ApplyUpdateResult = 'applied' | 'blocked' | 'unavailable';

/** Avisos que el registro del service worker entrega al estado. */
export interface SwCallbacks {
  readonly onOfflineReady: () => void;
  readonly onNeedRefresh: () => void;
  readonly onRegistered: () => void;
  readonly onError: (error: unknown) => void;
}

/** Registro mínimo que el estado necesita para aplicar una actualización. */
export interface SwRegistration {
  readonly update: (reloadPage?: boolean) => Promise<void>;
}

/** Dependencias inyectadas; permiten probar el estado sin navegador. */
export interface SwStatusOptions {
  readonly isSupported: () => boolean;
  readonly register: (callbacks: SwCallbacks) => Promise<SwRegistration>;
  readonly isVaultUnlocked: () => boolean;
}

/** Estado del service worker consumible desde React. */
export interface SwStatus {
  start(): Promise<void>;
  getState(): ServiceWorkerStatus;
  subscribe(listener: () => void): () => void;
  applyUpdate(): Promise<ApplyUpdateResult>;
}

/**
 * Crea el estado del service worker.
 *
 * No toca el DOM ni imprime errores: la interfaz decide qué mostrar y los detalles del fallo nunca
 * salen del módulo.
 */
export function createSwStatus(options: SwStatusOptions): SwStatus {
  // Sin soporte no hay nada que registrar; el estado queda fijo.
  const supported = options.isSupported();
  let state: ServiceWorkerStatus = supported ? 'registering' : 'unsupported';

  // El registro se guarda solo cuando `register()` resuelve.
  let registration: SwRegistration | null = null;

  // `start()` es idempotente: una segunda llamada no vuelve a registrar.
  let started = false;

  // Los suscriptores se notifican en orden de inserción.
  const listeners = new Set<() => void>();

  /** Notifica a todos los suscriptores; uno defectuoso no impide avisar a los demás. */
  const notify = (): void => {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // El fallo de un suscriptor no se propaga ni se registra.
      }
    }
  };

  /** Cambia el estado solo si es distinto y avisa a los suscriptores. */
  const setState = (next: ServiceWorkerStatus): void => {
    if (state === next) {
      return;
    }

    state = next;
    notify();
  };

  return {
    async start(): Promise<void> {
      if (!supported || started) {
        return;
      }

      // Se marca antes de esperar para que dos llamadas simultáneas no dupliquen el registro.
      started = true;

      try {
        const result = await options.register({
          onOfflineReady: () => {
            // Una actualización pendiente es más importante que el aviso de caché lista.
            if (state !== 'updateAvailable') {
              setState('offlineReady');
            }
          },
          onNeedRefresh: () => {
            setState('updateAvailable');
          },
          onRegistered: () => {
            // No se baja de `updateAvailable` si el aviso llegó antes.
            if (state === 'registering') {
              setState('offlineReady');
            }
          },
          onError: () => {
            setState('error');
          },
        });

        registration = result;

        // Si el registro terminó sin avisos, el cascarón ya está disponible sin conexión.
        if (state === 'registering') {
          setState('offlineReady');
        }
      } catch {
        // Un registro rechazado deja la app en línea, sin bloquearla.
        setState('error');
      }
    },

    getState(): ServiceWorkerStatus {
      return state;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    async applyUpdate(): Promise<ApplyUpdateResult> {
      // Solo se aplica una actualización que el navegador ya detectó.
      if (state !== 'updateAvailable' || registration === null) {
        return 'unavailable';
      }

      // Nunca se recarga con la bóveda desbloqueada: se perdería el trabajo en curso.
      if (options.isVaultUnlocked()) {
        return 'blocked';
      }

      try {
        // `true` activa el nuevo service worker; la librería recarga al tomar el control.
        await registration.update(true);

        return 'applied';
      } catch {
        setState('error');

        return 'unavailable';
      }
    },
  };
}
