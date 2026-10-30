// SPDX-License-Identifier: GPL-3.0-or-later

import {
  CorruptDataError,
  CryptoUnavailableError,
  UnsupportedVersionError,
  VaultLockedError,
} from '../crypto/errors';
import type { Keyring } from '../crypto/keyring';
import { getWebCrypto } from '../crypto/webcrypto';
import type { VolatileStateRegistry } from './volatileState';

/** Estados visibles de la bóveda. */
export type VaultViewState = 'loading' | 'uninitialized' | 'locked' | 'unlocked' | 'failed';

/** Motivo de un fallo fatal al cargar la bóveda. */
export type VaultFailure = 'crypto-unavailable' | 'storage' | 'corrupt' | 'unsupported-version';

/** Instantánea inmutable para `useSyncExternalStore`. */
export interface VaultSnapshot {
  readonly state: VaultViewState;
  readonly epoch: number;
  readonly failure: VaultFailure | null;
}

/** Controlador de sesión que conecta el llavero con la UI. */
export interface VaultController {
  /** Se suscribe a los cambios; devuelve la forma de cancelar la suscripción. */
  subscribe(listener: () => void): () => void;
  /** Devuelve la instantánea actual; es estable mientras no haya cambios. */
  getSnapshot(): VaultSnapshot;
  /** Carga el estado persistido sin pedir PIN. */
  start(): Promise<void>;
  /** Crea la bóveda y la deja desbloqueada. */
  setup(pin: string): Promise<void>;
  /** Desbloquea la bóveda. */
  unlock(pin: string): Promise<void>;
  /** Bloquea, limpia el estado volátil y avanza la época. */
  lock(): void;
}

/** Dependencias del controlador. */
export interface VaultControllerOptions {
  readonly keyring: Keyring;
  readonly volatileState: VolatileStateRegistry;
}

/** Traduce un error de carga a un motivo que la UI pueda localizar. */
function classifyFailure(error: unknown): VaultFailure {
  if (error instanceof CryptoUnavailableError) {
    return 'crypto-unavailable';
  }

  if (error instanceof CorruptDataError) {
    return 'corrupt';
  }

  if (error instanceof UnsupportedVersionError) {
    return 'unsupported-version';
  }

  return 'storage';
}

/** Crea el controlador de sesión. */
export function createVaultController(options: VaultControllerOptions): VaultController {
  const { keyring, volatileState } = options;
  const listeners = new Set<() => void>();

  // Se empieza cargando: la UI no debe mostrar el formulario de PIN antes de saber si hay bóveda.
  let snapshot: VaultSnapshot = { state: 'loading', epoch: 0, failure: null };

  /** Publica una instantánea nueva y notifica si cambió. */
  function publish(nextState: VaultViewState, failure: VaultFailure | null, epoch: number): void {
    if (nextState === snapshot.state && failure === snapshot.failure && epoch === snapshot.epoch) {
      return;
    }

    snapshot = { state: nextState, failure, epoch };

    // Un suscriptor defectuoso no impide que los demás se actualicen.
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // Sin consola: la UI no puede filtrar datos por un fallo de suscripción.
      }
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      return snapshot;
    },

    async start() {
      // Se vuelve a cargar antes de leer metadatos.
      publish('loading', null, snapshot.epoch);

      try {
        // Sin WebCrypto no se podrá derivar la clave; se falla antes de tocar el almacén.
        getWebCrypto();

        const state = await keyring.load();
        publish(state, null, snapshot.epoch);
      } catch (error) {
        // Un fallo de carga es fatal: la UI ofrece reintentar, nunca crear una bóveda nueva.
        publish('failed', classifyFailure(error), snapshot.epoch);
      }
    },

    async setup(pin) {
      try {
        // El llavero valida el PIN y deja la DEK en memoria.
        await keyring.initialize(pin);
      } catch (error) {
        // Un bloqueo durante la creación puede haber guardado metadatos antes de rechazar:
        // se reconcilia el estado para no mostrar «crear PIN» sobre una bóveda ya creada.
        if (error instanceof VaultLockedError) {
          publish(
            keyring.getState() === 'uninitialized' ? 'uninitialized' : 'locked',
            null,
            snapshot.epoch,
          );
        }

        throw error;
      }

      // Solo se publica si el llavero confirma que quedó desbloqueado.
      if (keyring.getState() === 'unlocked') {
        publish('unlocked', null, snapshot.epoch + 1);
      }
    },

    async unlock(pin) {
      try {
        // Un bloqueo durante la derivación hace que el llavero rechace la operación.
        await keyring.unlock(pin);
      } catch (error) {
        // Se reconcilia el estado si el bloqueo ocurrió durante la derivación.
        if (error instanceof VaultLockedError) {
          publish(
            keyring.getState() === 'uninitialized' ? 'uninitialized' : 'locked',
            null,
            snapshot.epoch,
          );
        }

        throw error;
      }

      // Solo se publica si el llavero confirma que quedó desbloqueado.
      if (keyring.getState() === 'unlocked') {
        publish('unlocked', null, snapshot.epoch + 1);
      }
    },

    lock() {
      // 1. Vaciar la clave del llavero. Si fallara, se continúa con los demás pasos.
      try {
        keyring.lock();
      } catch {
        // El llavero no debería fallar; la UI igualmente debe quedar bloqueada.
      }

      // 2. Descartar el estado volátil (caso en curso, consentimiento sin guardar, etc.).
      try {
        volatileState.clearAll();
      } catch {
        // Una limpieza defectuosa no debe impedir el bloqueo visual.
      }

      // 3. Publicar el estado real, con `uninitialized` solo si no hay metadatos.
      let nextState: VaultViewState;
      try {
        nextState = keyring.getState() === 'uninitialized' ? 'uninitialized' : 'locked';
      } catch {
        // Si no se puede consultar el estado, se falla hacia el lado seguro.
        nextState = 'locked';
      }

      // La época cambia siempre para invalidar datos capturados antes del bloqueo.
      publish(nextState, null, snapshot.epoch + 1);
    },
  };
}
