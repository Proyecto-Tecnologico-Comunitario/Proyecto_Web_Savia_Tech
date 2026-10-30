// SPDX-License-Identifier: GPL-3.0-or-later

import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CorruptDataError,
  CryptoUnavailableError,
  IncorrectPinError,
  InvalidPinError,
  UnsupportedVersionError,
  VaultLockedError,
} from '../../crypto/errors';
import { createKeyring, type Keyring } from '../../crypto/keyring';
import type { CryptoMetadataStore } from '../../crypto/metadata';
import { DexieCryptoMetadataStore } from '../../storage/cryptoMetadataStore';
import { SaviaDatabase } from '../../storage/db';
import { createVaultController, type VaultController } from '../vaultController';
import { createVolatileStateRegistry, type VolatileStateRegistry } from '../volatileState';

/** Iteraciones bajas para que las pruebas no dominen la suite. */
const TEST_ITERATIONS = 1_000;

/** PIN sintético de prueba. */
const PIN = '123456';

/** Bases abiertas que deben limpiarse después de cada prueba. */
const databases = new Set<SaviaDatabase>();

/** Contador para aislar cada base de datos. */
let databaseCounter = 0;

/** Genera un nombre único de base de datos de prueba. */
function nextDatabaseName(): string {
  // Se incrementa el contador del módulo.
  databaseCounter += 1;

  // El nombre no contiene datos personales.
  return `saviatech-controller-test-${databaseCounter}`;
}

/** Piezas de una prueba del controlador. */
interface Harness {
  readonly keyring: Keyring;
  readonly volatileState: VolatileStateRegistry;
  readonly controller: VaultController;
}

/** Crea un llavero real con almacén de metadatos real o inyectado. */
function makeHarness(store?: CryptoMetadataStore): Harness {
  // Se abre una base aislada.
  const db = new SaviaDatabase(nextDatabaseName());
  databases.add(db);

  // El almacén real usa Dexie; las pruebas de fallo inyectan un doble.
  const metadataStore = store ?? new DexieCryptoMetadataStore(db);

  // El llavero usa pocas iteraciones solo durante las pruebas.
  const keyring = createKeyring({
    store: metadataStore,
    iterations: TEST_ITERATIONS,
    minimumIterations: TEST_ITERATIONS,
  });

  // El registro volátil es real: solo se comprueba que se limpia.
  const volatileState = createVolatileStateRegistry();

  return {
    keyring,
    volatileState,
    controller: createVaultController({ keyring, volatileState }),
  };
}

afterEach(async () => {
  // Primero se cierran todas las conexiones.
  for (const db of databases) {
    db.close();
  }

  // Después se eliminan las bases para dejar fake-indexeddb limpio.
  for (const db of databases) {
    await db.delete();
  }

  // Se vacía el registro para la siguiente prueba.
  databases.clear();
});

describe('vault controller', () => {
  it('starts in loading and loads the persisted state', async () => {
    // Antes de cargar, la UI no debe mostrar el formulario de PIN.
    const { controller } = makeHarness();

    expect(controller.getSnapshot().state).toBe('loading');

    const first = controller.getSnapshot();
    await controller.start();

    expect(controller.getSnapshot().state).toBe('uninitialized');
    expect(controller.getSnapshot().failure).toBeNull();
    expect(controller.getSnapshot()).not.toBe(first);
    expect(controller.getSnapshot()).toBe(controller.getSnapshot());
  });

  it('unlocks after setup and advances the epoch', async () => {
    // Crear la bóveda deja la sesión desbloqueada.
    const { controller } = makeHarness();
    await controller.start();

    const before = controller.getSnapshot().epoch;
    await controller.setup(PIN);

    expect(controller.getSnapshot().state).toBe('unlocked');
    expect(controller.getSnapshot().failure).toBeNull();
    expect(controller.getSnapshot().epoch).toBe(before + 1);
  });

  it('locks, clears volatile state and advances the epoch', async () => {
    // El bloqueo debe vaciar el caso en curso además de la clave.
    const { controller, volatileState } = makeHarness();
    await controller.start();
    await controller.setup(PIN);

    const clear = vi.fn();
    volatileState.register(clear);

    const before = controller.getSnapshot().epoch;
    controller.lock();

    expect(clear).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().state).toBe('locked');
    expect(controller.getSnapshot().failure).toBeNull();
    expect(controller.getSnapshot().epoch).toBe(before + 1);
  });

  it('reports uninitialized when locking before the vault exists', async () => {
    // Sin metadatos, el bloqueo vuelve a la pantalla de creación.
    const { controller } = makeHarness();
    await controller.start();

    controller.lock();

    expect(controller.getSnapshot().state).toBe('uninitialized');
  });

  it('unlocks again after locking', async () => {
    // El PIN correcto vuelve a abrir la misma bóveda.
    const { controller } = makeHarness();
    await controller.start();
    await controller.setup(PIN);
    controller.lock();

    const before = controller.getSnapshot().epoch;
    await controller.unlock(PIN);

    expect(controller.getSnapshot().state).toBe('unlocked');
    expect(controller.getSnapshot().epoch).toBe(before + 1);
  });

  it('rejects an unlock that races with a lock and stays locked', async () => {
    // La generación del llavero impide publicar una clave después del bloqueo.
    const { controller } = makeHarness();
    await controller.start();
    await controller.setup(PIN);
    controller.lock();

    const pending = controller.unlock(PIN);
    controller.lock();

    await expect(pending).rejects.toBeInstanceOf(VaultLockedError);
    expect(controller.getSnapshot().state).toBe('locked');
  });

  it('rejects a setup that races with a lock without exposing a vault', async () => {
    // Si el bloqueo llega antes de persistir los metadatos, la bóveda sigue sin crear.
    const { controller } = makeHarness();
    await controller.start();

    const pending = controller.setup(PIN);
    controller.lock();

    await expect(pending).rejects.toBeInstanceOf(VaultLockedError);
    expect(controller.getSnapshot().state).toBe('uninitialized');
  });

  it('rejects a wrong PIN and keeps the vault locked', async () => {
    // Un PIN incorrecto se propaga a la UI sin cambiar el estado de sesión.
    const { controller } = makeHarness();
    await controller.start();
    await controller.setup(PIN);
    controller.lock();

    await expect(controller.unlock('000000')).rejects.toBeInstanceOf(IncorrectPinError);
    expect(controller.getSnapshot().state).toBe('locked');
  });

  it('rejects an invalid PIN before creating the vault', async () => {
    // La política de PIN se aplica antes de cualquier escritura.
    const { controller } = makeHarness();
    await controller.start();

    await expect(controller.setup('abc')).rejects.toBeInstanceOf(InvalidPinError);
    expect(controller.getSnapshot().state).toBe('uninitialized');
  });

  it('can retry start after a fatal failure', async () => {
    // Un fallo de lectura no debe obligar a crear una bóveda nueva.
    let failure: Error | null = new CorruptDataError();
    const store: CryptoMetadataStore = {
      load: async () => {
        if (failure !== null) {
          throw failure;
        }

        return null;
      },
      save: async () => undefined,
    };

    const { controller } = makeHarness(store);

    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({ state: 'failed', failure: 'corrupt' });

    failure = null;
    await controller.start();

    expect(controller.getSnapshot()).toMatchObject({ state: 'uninitialized', failure: null });
  });

  const failureCases = [
    { error: new CryptoUnavailableError(), failure: 'crypto-unavailable' },
    { error: new CorruptDataError(), failure: 'corrupt' },
    { error: new UnsupportedVersionError(2), failure: 'unsupported-version' },
    { error: new Error('dexie failed'), failure: 'storage' },
  ] as const;

  it.each(failureCases)('classifies $failure as a fatal failure', async ({ error, failure }) => {
    // Cada error de carga se traduce a una pantalla fatal concreta.
    const store: CryptoMetadataStore = {
      load: async () => {
        throw error;
      },
      save: async () => undefined,
    };

    const { controller } = makeHarness(store);
    await controller.start();

    expect(controller.getSnapshot()).toMatchObject({ state: 'failed', failure });
  });

  it('still clears state and publishes locked when the keyring lock throws', async () => {
    // La UI no puede quedarse mostrando datos si el llavero falla al bloquear.
    const keyring: Keyring = {
      load: async () => 'locked',
      initialize: async () => undefined,
      unlock: async () => undefined,
      lock: () => {
        throw new Error('lock failed');
      },
      changePin: async () => undefined,
      getState: () => 'unlocked',
      withDataKey: async () => {
        throw new Error('not used');
      },
    };

    const volatileState = createVolatileStateRegistry();
    const clear = vi.fn();
    volatileState.register(clear);

    const controller = createVaultController({ keyring, volatileState });

    expect(() => controller.lock()).not.toThrow();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().state).toBe('locked');
  });

  it('stops notifying after unsubscribe', async () => {
    // La suscripción se puede cancelar sin efectos posteriores.
    const { controller } = makeHarness();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    await controller.start();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    controller.lock();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
