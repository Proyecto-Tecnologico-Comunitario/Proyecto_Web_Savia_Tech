// SPDX-License-Identifier: GPL-3.0-or-later

import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CorruptDataError,
  IncorrectPinError,
  InvalidPinError,
  TooManyAttemptsError,
  UnsupportedVersionError,
  VaultAlreadyInitializedError,
  VaultLockedError,
  VaultNotInitializedError,
} from '../errors';
import { createKeyring, type DataKeySession, type Keyring } from '../keyring';
import type { CryptoMetadata, CryptoMetadataStore } from '../metadata';
import { CRYPTO_METADATA_KEY } from '../constants';
import { DexieCryptoMetadataStore } from '../../storage/cryptoMetadataStore';
import { SaviaDatabase } from '../../storage/db';

/** Iteraciones bajas para que las pruebas del llavero no dominen la suite. */
const TEST_ITERATIONS = 1_000;

/** PIN sintético de prueba. */
const PIN = '123456';

/** PIN nuevo sintético de prueba. */
const NEW_PIN = '654321';

/** Bases abiertas que deben limpiarse después de cada prueba. */
const databases = new Set<SaviaDatabase>();

/** Contador para aislar cada base de datos. */
let databaseCounter = 0;

/** Genera un nombre único de base de datos de prueba. */
function nextDatabaseName(): string {
  // Se incrementa el contador del módulo.
  databaseCounter += 1;

  // El nombre no contiene datos personales.
  return `saviatech-test-${databaseCounter}`;
}

/** Conjunto de piezas de una prueba del llavero. */
interface Harness {
  name: string;
  db: SaviaDatabase;
  store: DexieCryptoMetadataStore;
  keyring: Keyring;
}

/** Crea una base aislada y un llavero con reloj inyectable. */
function makeHarness(name: string = nextDatabaseName(), now: () => number = () => 0): Harness {
  // Se abre una base nueva con el nombre aislado.
  const db = new SaviaDatabase(name);

  // Se registra para cerrarla y eliminarla al terminar.
  databases.add(db);

  // La capa de datos usa el adaptador real de Dexie.
  const store = new DexieCryptoMetadataStore(db);

  // El llavero usa pocas iteraciones solo durante las pruebas.
  const keyring = createKeyring({
    store,
    iterations: TEST_ITERATIONS,
    minimumIterations: TEST_ITERATIONS,
    now,
  });

  // Se devuelven todas las piezas para poder reabrir la misma base.
  return { name, db, store, keyring };
}

/** Simula una recarga cerrando la base y abriendo otra instancia. */
function reopen(harness: Harness, now: () => number = () => 0): Harness {
  // Se cierra la conexión anterior antes de abrir la misma base.
  harness.db.close();

  // Se crea una instancia limpia con el mismo nombre persistido.
  return makeHarness(harness.name, now);
}

afterEach(async () => {
  // Primero se cierran todas las conexiones, incluidas las reabiertas con el mismo nombre.
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

describe('keyring', () => {
  it('initializes the vault and stores only non-secret metadata', async () => {
    // Se parte de un almacén sin inicializar.
    const { store, keyring } = makeHarness();
    expect(keyring.getState()).toBe('uninitialized');
    expect(await keyring.load()).toBe('uninitialized');

    // La inicialización deja el almacén desbloqueado.
    await keyring.initialize(PIN);
    expect(keyring.getState()).toBe('unlocked');

    // Los metadatos no contienen el PIN en claro.
    const metadata = await store.load();
    if (metadata === null) {
      throw new Error('Expected metadata after initialization');
    }

    // La sal y la DEK envuelta tienen los tamaños del formato.
    expect(metadata.kdf.salt).toHaveLength(16);
    expect(metadata.wrappedDataKey).toHaveLength(40);
    expect(metadata.kdf.iterations).toBe(TEST_ITERATIONS);
    expect(metadata.failedAttempts).toBe(0);
    expect(metadata.lockedUntil).toBeNull();
    expect(JSON.stringify(metadata)).not.toContain(PIN);

    // La DEK activa no se puede exportar.
    const extractable = await keyring.withDataKey(async (session) => session.extractable);
    expect(extractable).toBe(false);
  });

  it('reloads locked and unlocks with the correct PIN', async () => {
    // Se inicializa y luego se simula una recarga.
    const first = makeHarness();
    await first.keyring.initialize(PIN);

    const second = reopen(first);

    // Al cargar de nuevo, el almacén queda bloqueado.
    expect(await second.keyring.load()).toBe('locked');
    expect(second.keyring.getState()).toBe('locked');

    // El PIN correcto desbloquea y permite usar la DEK.
    await second.keyring.unlock(PIN);
    expect(second.keyring.getState()).toBe('unlocked');
    const usable = await second.keyring.withDataKey(async (session) => {
      // La vista acotada permite cifrar y descifrar sin exponer el `CryptoKey`.
      const record = await session.encrypt('cases', 'case-1', { synthetic: true });
      const decrypted = await session.decrypt<{ synthetic: boolean }>('cases', 'case-1', record);
      return decrypted.synthetic;
    });
    expect(usable).toBe(true);
  });

  it('locks the vault and rejects data operations', async () => {
    // Se inicializa y se captura una vista junto con un registro cifrado.
    const { keyring } = makeHarness();
    await keyring.initialize(PIN);

    const capturedSessions: DataKeySession[] = [];
    const record = await keyring.withDataKey(async (session) => {
      capturedSessions.push(session);
      return session.encrypt('cases', 'case-1', { synthetic: true });
    });

    // Se bloquea explícitamente.
    keyring.lock();

    // El estado cambia y ya no se pueden abrir vistas nuevas.
    expect(keyring.getState()).toBe('locked');
    await expect(keyring.withDataKey(async () => true)).rejects.toBeInstanceOf(VaultLockedError);

    // Una vista capturada antes del bloqueo tampoco puede seguir operando.
    const capturedSession = capturedSessions[0];
    if (capturedSession === undefined) {
      throw new Error('Expected a captured data key session');
    }
    await expect(
      capturedSession.encrypt('cases', 'case-2', { synthetic: true }),
    ).rejects.toBeInstanceOf(VaultLockedError);
    await expect(capturedSession.decrypt('cases', 'case-1', record)).rejects.toBeInstanceOf(
      VaultLockedError,
    );
  });

  it('enforces the lockout delay and persists it across a reload', async () => {
    // Se usa un reloj controlado para no esperar en tiempo real.
    let currentTime = 0;
    const first = makeHarness(undefined, () => currentTime);
    await first.keyring.initialize(PIN);
    first.keyring.lock();

    // Los dos primeros fallos no añaden espera.
    await expect(first.keyring.unlock('000000')).rejects.toBeInstanceOf(IncorrectPinError);
    await expect(first.keyring.unlock('000000')).rejects.toBeInstanceOf(IncorrectPinError);

    // El tercer fallo activa cinco segundos de espera.
    await expect(first.keyring.unlock('000000')).rejects.toBeInstanceOf(IncorrectPinError);

    const afterFailures = await first.store.load();
    if (afterFailures === null) {
      throw new Error('Expected metadata after failures');
    }

    // El contador y la espera quedan persistidos.
    expect(afterFailures.failedAttempts).toBe(3);
    expect(afterFailures.lockedUntil).toBe(5_000);

    // Incluso el PIN correcto se rechaza mientras dura la espera.
    currentTime = 1_000;
    await expect(first.keyring.unlock(PIN)).rejects.toMatchObject({ retryAfterMs: 4_000 });

    // Una instancia nueva conserva la espera.
    const second = reopen(first, () => currentTime);
    expect(await second.keyring.load()).toBe('locked');
    await expect(second.keyring.unlock(PIN)).rejects.toBeInstanceOf(TooManyAttemptsError);

    // Al pasar el tiempo, el PIN correcto desbloquea.
    currentTime = 5_001;
    await second.keyring.unlock(PIN);
    expect(second.keyring.getState()).toBe('unlocked');

    const afterSuccess = await second.store.load();
    if (afterSuccess === null) {
      throw new Error('Expected metadata after success');
    }

    // El acierto reinicia el contador y la espera.
    expect(afterSuccess.failedAttempts).toBe(0);
    expect(afterSuccess.lockedUntil).toBeNull();
  });

  it('serializes concurrent wrong-PIN attempts so no failure is lost', async () => {
    // Se inicializa y se bloquea antes de lanzar los intentos en paralelo.
    const { store, keyring } = makeHarness();
    await keyring.initialize(PIN);
    keyring.lock();

    // Tres llamadas simultáneas deben contarse una tras otra.
    const results = await Promise.allSettled([
      keyring.unlock('000000'),
      keyring.unlock('000000'),
      keyring.unlock('000000'),
    ]);

    // Todas fallan con el error genérico y ninguna pierde el incremento.
    for (const result of results) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.reason).toBeInstanceOf(IncorrectPinError);
      }
    }

    const metadata = await store.load();
    expect(metadata?.failedAttempts).toBe(3);
    expect(metadata?.lockedUntil).toBe(5_000);
  });

  it('does not reopen the vault when lock happens during unlock', async () => {
    // Se prepara un almacén inicializado y bloqueado.
    const first = makeHarness();
    await first.keyring.initialize(PIN);
    first.keyring.lock();

    // El puerto simula un bloqueo durante la escritura de metadatos del desbloqueo.
    const holder: { keyring?: Keyring } = {};
    let lockOnNextSave = false;
    const gatedStore: CryptoMetadataStore = {
      load: () => first.store.load(),
      save: async (metadata) => {
        if (lockOnNextSave) {
          lockOnNextSave = false;
          holder.keyring?.lock();
        }
        await first.store.save(metadata);
      },
    };

    const keyring = createKeyring({
      store: gatedStore,
      iterations: TEST_ITERATIONS,
      minimumIterations: TEST_ITERATIONS,
      now: () => 0,
    });
    holder.keyring = keyring;
    await keyring.load();

    // El bloqueo gana aunque el PIN sea correcto.
    lockOnNextSave = true;
    await expect(keyring.unlock(PIN)).rejects.toBeInstanceOf(VaultLockedError);
    expect(keyring.getState()).toBe('locked');
  });

  it('does not reopen when lock happens before a queued unlock starts', async () => {
    // Se prepara un almacén bloqueado.
    const { keyring } = makeHarness();
    await keyring.initialize(PIN);
    keyring.lock();

    // La operación se encola y el bloqueo llega antes de que la tarea empiece.
    const pendingUnlock = keyring.unlock(PIN);
    keyring.lock();

    await expect(pendingUnlock).rejects.toBeInstanceOf(VaultLockedError);
    expect(keyring.getState()).toBe('locked');
  });

  it('grows the wait up to five minutes after repeated failures', async () => {
    // Se controla el reloj para recorrer todos los tramos.
    let currentTime = 0;
    const { store, keyring } = makeHarness(undefined, () => currentTime);
    await keyring.initialize(PIN);
    keyring.lock();

    // Fallo 1 y 2: sin espera.
    await expect(keyring.unlock('000000')).rejects.toBeInstanceOf(IncorrectPinError);
    await expect(keyring.unlock('000000')).rejects.toBeInstanceOf(IncorrectPinError);

    // Fallo 3: cinco segundos.
    await expect(keyring.unlock('000000')).rejects.toBeInstanceOf(IncorrectPinError);
    expect((await store.load())?.lockedUntil).toBe(5_000);

    // Fallo 4: treinta segundos desde el nuevo instante.
    currentTime = 5_000;
    await expect(keyring.unlock('000000')).rejects.toBeInstanceOf(IncorrectPinError);
    expect((await store.load())?.lockedUntil).toBe(35_000);

    // Fallo 5: cinco minutos.
    currentTime = 35_000;
    await expect(keyring.unlock('000000')).rejects.toBeInstanceOf(IncorrectPinError);
    expect((await store.load())?.lockedUntil).toBe(335_000);

    // Fallo 6: se mantiene el máximo de cinco minutos.
    currentTime = 335_000;
    await expect(keyring.unlock('000000')).rejects.toBeInstanceOf(IncorrectPinError);
    expect((await store.load())?.lockedUntil).toBe(635_000);
  });

  it('changes the PIN without re-encrypting records', async () => {
    // Se crea un registro con la DEK original.
    const { store, keyring } = makeHarness();
    await keyring.initialize(PIN);
    const record = await keyring.withDataKey((session) =>
      session.encrypt('cases', 'case-1', { synthetic: true, score: 5 }),
    );

    const before = await store.load();
    if (before === null) {
      throw new Error('Expected metadata before PIN change');
    }

    // Se cambia el PIN; solo debe cambiar la envoltura de la DEK.
    await keyring.changePin(PIN, NEW_PIN);

    const after = await store.load();
    if (after === null) {
      throw new Error('Expected metadata after PIN change');
    }

    // La sal y la DEK envuelta cambian, pero los registros no.
    expect(after.kdf.salt).not.toEqual(before.kdf.salt);
    expect(after.wrappedDataKey).not.toEqual(before.wrappedDataKey);

    // El PIN viejo ya no desbloquea.
    keyring.lock();
    await expect(keyring.unlock(PIN)).rejects.toBeInstanceOf(IncorrectPinError);

    // El PIN nuevo desbloquea y descifra el registro antiguo.
    await keyring.unlock(NEW_PIN);
    const decrypted = await keyring.withDataKey((session) =>
      session.decrypt('cases', 'case-1', record),
    );
    expect(decrypted).toEqual({ synthetic: true, score: 5 });

    // La DEK activa sigue siendo no extraíble.
    const extractable = await keyring.withDataKey(async (session) => session.extractable);
    expect(extractable).toBe(false);
  });

  it('counts a wrong current PIN when changing the PIN', async () => {
    // Se inicializa, se bloquea y se intenta cambiar con un PIN incorrecto.
    const { store, keyring } = makeHarness();
    await keyring.initialize(PIN);
    keyring.lock();

    // El error no revela si el PIN existía o no.
    await expect(keyring.changePin('000000', NEW_PIN)).rejects.toBeInstanceOf(IncorrectPinError);

    // El fallo se persiste para el siguiente intento.
    expect((await store.load())?.failedAttempts).toBe(1);
  });

  it('validates PIN format without touching storage', async () => {
    // Se rechazan PIN demasiado cortos y no numéricos.
    const { keyring } = makeHarness();
    await expect(keyring.initialize('12345')).rejects.toBeInstanceOf(InvalidPinError);
    await expect(keyring.initialize('abcdef')).rejects.toBeInstanceOf(InvalidPinError);
  });

  it('rejects duplicate initialization and unlocking before setup', async () => {
    // Sin metadatos, no se puede desbloquear.
    const { keyring } = makeHarness();
    await expect(keyring.unlock(PIN)).rejects.toBeInstanceOf(VaultNotInitializedError);

    // La primera inicialización funciona.
    await keyring.initialize(PIN);

    // La segunda no debe sobrescribir las claves existentes.
    await expect(keyring.initialize(PIN)).rejects.toBeInstanceOf(VaultAlreadyInitializedError);
  });

  it('uses independent salt and wrapped key for every initialization', async () => {
    // Dos instalaciones sintéticas con el mismo PIN.
    const first = makeHarness();
    const second = makeHarness();
    await first.keyring.initialize(PIN);
    await second.keyring.initialize(PIN);

    const firstMetadata = await first.store.load();
    const secondMetadata = await second.store.load();
    if (firstMetadata === null || secondMetadata === null) {
      throw new Error('Expected metadata for both vaults');
    }

    // La sal aleatoria separa las claves derivadas.
    expect(firstMetadata.kdf.salt).not.toEqual(secondMetadata.kdf.salt);
    expect(firstMetadata.wrappedDataKey).not.toEqual(secondMetadata.wrappedDataKey);
  });

  it('rejects a metadata row without a value', async () => {
    // Una fila existente sin valor no equivale a un almacén sin inicializar.
    const { db, keyring } = makeHarness();
    await db.cryptoMetadata.put({
      key: CRYPTO_METADATA_KEY,
      value: null as unknown as CryptoMetadata,
    });

    await expect(keyring.load()).rejects.toBeInstanceOf(CorruptDataError);
  });

  it('rejects unsupported metadata versions', async () => {
    // Se escribe un registro deliberadamente inválido.
    const { db, store, keyring } = makeHarness();
    await db.cryptoMetadata.put({
      key: CRYPTO_METADATA_KEY,
      value: { v: 2 } as unknown as CryptoMetadata,
    });

    // El llavero no debe aceptar un formato que no entiende.
    await expect(keyring.load()).rejects.toBeInstanceOf(UnsupportedVersionError);

    // El adaptador devuelve el valor sin interpretarlo.
    expect(await store.load()).not.toBeNull();
  });
});
