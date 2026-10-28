// SPDX-License-Identifier: GPL-3.0-or-later

import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { CRYPTO_FORMAT_VERSION } from '../../crypto/constants';
import { CorruptDataError, IncorrectPinError, VaultLockedError } from '../../crypto/errors';
import { createKeyring, type DataKeySession, type Keyring } from '../../crypto/keyring';
import type { EncryptedRecord } from '../../crypto/recordCipher';
import {
  type CasePayload,
  type CaseRecord,
  type ConsentEntry,
  generateCaseCode,
  type ScreeningEntry,
} from '../../model/case';
import { type CaseRepository, createCaseRepository, type NewCaseInput } from '../caseRepository';
import { DexieCryptoMetadataStore } from '../cryptoMetadataStore';
import { SaviaDatabase } from '../db';
import {
  CaseNotFoundError,
  ConcurrentModificationError,
  ImmutableFieldError,
  InvalidCaseDataError,
} from '../errors';

/** Iteraciones bajas: solo reducen el coste del KDF durante las pruebas. */
const TEST_ITERATIONS = 1_000;

/** PIN sintético de prueba. */
const PIN = '123456';

/** PIN nuevo sintético de prueba. */
const NEW_PIN = '654321';

/**
 * Consentimiento sintético.
 *
 * `19:02Z` equivale a las 14:02 en Colombia (`America/Bogota`, UTC-5). El instante se guarda en UTC.
 */
const CONSENT: ConsentEntry = {
  textVersion: 'sample-1',
  timestamp: '2026-10-28T19:02:00Z',
};

/** Tamizaje sintético con bandas iguales. */
const SCREENING: ScreeningEntry = {
  instrumentId: 'phq9-sample',
  instrumentVersion: '0.1',
  answers: [0, 1, 2, 1, 0, 1, 0, 0, 0],
  score: 5,
  computedBand: 'mild',
  finalBand: 'mild',
  justification: null,
  safetyAlert: false,
  timestamp: '2026-10-28T19:10:00Z',
};

/** Entrada sintética para crear un caso. */
const NEW_CASE: NewCaseInput = {
  consent: CONSENT,
  synthetic: true,
  screenings: [SCREENING],
};

/** Bases abiertas que deben limpiarse después de cada prueba. */
const databases = new Set<SaviaDatabase>();

/** Contador para aislar cada base de datos. */
let databaseCounter = 0;

/** Genera un nombre único de base de datos de prueba. */
function nextDatabaseName(): string {
  // Se incrementa el contador del módulo.
  databaseCounter += 1;

  // El nombre no contiene datos personales.
  return `saviatech-test-repository-${databaseCounter}`;
}

/** Conjunto de piezas de una prueba del repositorio. */
interface Harness {
  db: SaviaDatabase;
  keyring: Keyring;
  repository: CaseRepository;
}

/** Crea una base aislada, un llavero real y un repositorio. */
function makeHarness(): Harness {
  // Se abre una base nueva con el nombre aislado.
  const db = new SaviaDatabase(nextDatabaseName());
  databases.add(db);

  // La capa de datos usa el adaptador real de Dexie.
  const store = new DexieCryptoMetadataStore(db);

  // El llavero usa pocas iteraciones solo durante las pruebas.
  const keyring = createKeyring({
    store,
    iterations: TEST_ITERATIONS,
    minimumIterations: TEST_ITERATIONS,
  });

  // El repositorio recibe sus dependencias; no hay singletons en esta capa.
  const repository = createCaseRepository({ db, keyring });

  return { db, keyring, repository };
}

/** Inicializa el llavero con el PIN sintético. */
async function initializeVault(harness: Harness): Promise<void> {
  await harness.keyring.initialize(PIN);
}

/**
 * Envuelve un llavero para poder contar cuántas veces se descifra.
 *
 * Así se comprueba que `list` descifra solo la página y no la tabla completa.
 */
function countDecrypts(keyring: Keyring): { keyring: Keyring; count: () => number } {
  let decryptCalls = 0;

  const wrapped: Keyring = {
    load: () => keyring.load(),
    initialize: (pin) => keyring.initialize(pin),
    unlock: (pin) => keyring.unlock(pin),
    lock: () => keyring.lock(),
    changePin: (currentPin, newPin) => keyring.changePin(currentPin, newPin),
    getState: () => keyring.getState(),
    withDataKey: <T>(operation: (session: DataKeySession) => Promise<T>): Promise<T> =>
      keyring.withDataKey((session) =>
        operation({
          extractable: session.extractable,
          encrypt: <R>(table: string, id: string, value: R): Promise<EncryptedRecord> =>
            session.encrypt(table, id, value),
          decrypt: async <R>(table: string, id: string, record: EncryptedRecord): Promise<R> => {
            decryptCalls += 1;
            return session.decrypt<R>(table, id, record);
          },
        }),
      ),
  };

  return { keyring: wrapped, count: () => decryptCalls };
}

/**
 * Envuelve un llavero para sincronizar dos descifrados.
 *
 * La prueba de concurrencia necesita que ambas actualizaciones lean la misma fila antes de que
 * cualquiera escriba. La barrera se libera cuando las dos han descifrado.
 */
function synchronizeDecrypts(keyring: Keyring, participants: number): Keyring {
  let decryptCalls = 0;
  let releaseBarrier: () => void = () => undefined;
  const barrier = new Promise<void>((resolve) => {
    releaseBarrier = resolve;
  });

  return {
    load: () => keyring.load(),
    initialize: (pin) => keyring.initialize(pin),
    unlock: (pin) => keyring.unlock(pin),
    lock: () => keyring.lock(),
    changePin: (currentPin, newPin) => keyring.changePin(currentPin, newPin),
    getState: () => keyring.getState(),
    withDataKey: <T>(operation: (session: DataKeySession) => Promise<T>): Promise<T> =>
      keyring.withDataKey((session) =>
        operation({
          extractable: session.extractable,
          encrypt: <R>(table: string, id: string, value: R): Promise<EncryptedRecord> =>
            session.encrypt(table, id, value),
          decrypt: async <R>(table: string, id: string, record: EncryptedRecord): Promise<R> => {
            const result = await session.decrypt<R>(table, id, record);

            decryptCalls += 1;
            if (decryptCalls === participants) {
              releaseBarrier();
            }

            await barrier;
            return result;
          },
        }),
      ),
  };
}

/** Identificador determinista para datos sembrados; no contiene datos personales. */
function seededId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

/** Siembra casos cifrados con marcas de actualización crecientes. */
async function seedCases(db: SaviaDatabase, keyring: Keyring, count: number): Promise<void> {
  // Se cifran todos los casos con la misma DEK, como haría el repositorio.
  const records = await keyring.withDataKey(async (session) => {
    const encrypted: EncryptedRecord[] = [];

    for (let index = 0; index < count; index += 1) {
      const payload: CasePayload = {
        code: generateCaseCode(),
        synthetic: true,
        createdAt: '2026-10-28T19:03:00Z',
        consent: CONSENT,
        screenings: [],
      };

      const record = await session.encrypt('cases', seededId(index), payload);

      // Se fuerza un orden determinista para comprobar la paginación.
      encrypted.push({ ...record, actualizadoEn: index });
    }

    return encrypted;
  });

  // Se insertan en una sola operación para no abrir una transacción por caso.
  await db.cases.bulkAdd(records);
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

  databases.clear();
});

describe('case repository', () => {
  it('creates, gets and lists the same case (T4-01)', async () => {
    // Se prepara un almacén desbloqueado.
    const harness = makeHarness();
    await initializeVault(harness);

    // El repositorio genera id, código y fecha de creación.
    const created = await harness.repository.create(NEW_CASE);

    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(created.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(created.synthetic).toBe(true);
    expect(created.consent).toEqual(CONSENT);
    expect(created.screenings).toEqual([SCREENING]);
    expect(created.updatedAt).toBeGreaterThan(0);

    // La lectura devuelve exactamente lo creado.
    await expect(harness.repository.get(created.id)).resolves.toEqual(created);

    // El listado también devuelve el caso y no deja filas ilegibles.
    await expect(harness.repository.list()).resolves.toEqual({
      items: [created],
      unreadableIds: [],
    });

    // El contador no necesita descifrar.
    await expect(harness.repository.count()).resolves.toBe(1);

    // Un id inexistente devuelve `null`, no un error.
    await expect(
      harness.repository.get('00000000-0000-4000-8000-000000000000'),
    ).resolves.toBeNull();
  });

  it('creates a case with an empty screening list by default', async () => {
    // Los tamizajes son opcionales al crear.
    const harness = makeHarness();
    await initializeVault(harness);

    const created = await harness.repository.create({ consent: CONSENT, synthetic: true });

    expect(created.screenings).toEqual([]);
  });

  it('keeps case data out of the raw IndexedDB rows (T4-02)', async () => {
    // Se usa una justificación visible solo dentro del cifrado.
    const harness = makeHarness();
    await initializeVault(harness);

    const justification = 'Justificación sintética que no debe aparecer en claro';
    const created = await harness.repository.create({
      consent: CONSENT,
      synthetic: true,
      screenings: [
        {
          ...SCREENING,
          instrumentId: 'synthetic-instrument',
          finalBand: 'moderate',
          justification,
        },
      ],
    });

    // Se leen las filas en crudo, como haría alguien con acceso a IndexedDB.
    const rows = await harness.db.cases.toArray();
    expect(rows).toHaveLength(1);

    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected one case row');
    }

    // La fila solo expone el id, la versión, el IV, el ciphertext y la marca de ordenación.
    expect(Object.keys(row).sort()).toEqual(['actualizadoEn', 'ct', 'id', 'iv', 'v']);

    // Los bytes se serializan como números para revisar también el contenido del ciphertext.
    const serialized = JSON.stringify(row, (_key, value) =>
      value instanceof Uint8Array ? Array.from(value) : value,
    );

    // Ningún nombre de campo del payload queda en claro.
    for (const fieldName of [
      'code',
      'synthetic',
      'createdAt',
      'consent',
      'textVersion',
      'screenings',
      'instrumentId',
      'instrumentVersion',
      'answers',
      'score',
      'computedBand',
      'finalBand',
      'justification',
      'safetyAlert',
      'timestamp',
    ]) {
      expect(serialized).not.toContain(fieldName);
    }

    // Los valores largos tampoco aparecen al decodificar el ciphertext como texto.
    const ciphertextText = new TextDecoder().decode(row.ct);
    for (const secret of [
      created.code,
      justification,
      'synthetic-instrument',
      CONSENT.textVersion,
    ]) {
      expect(ciphertextText).not.toContain(secret);
    }
  });

  it('requires an unlocked vault for every operation (T4-03)', async () => {
    // Se crea el repositorio antes de bloquear, como haría la app al inicio.
    const harness = makeHarness();
    await initializeVault(harness);
    const created = await harness.repository.create(NEW_CASE);

    harness.keyring.lock();

    // Crear, leer, listar y contar fallan igual con el almacén bloqueado.
    await expect(harness.repository.create(NEW_CASE)).rejects.toBeInstanceOf(VaultLockedError);
    await expect(harness.repository.get(created.id)).rejects.toBeInstanceOf(VaultLockedError);
    await expect(harness.repository.list()).rejects.toBeInstanceOf(VaultLockedError);
    await expect(harness.repository.count()).rejects.toBeInstanceOf(VaultLockedError);

    // Actualizar también exige la DEK, aunque la fila exista.
    await expect(
      harness.repository.update(created.id, (current) => current),
    ).rejects.toBeInstanceOf(VaultLockedError);
  });

  it('rejects a ciphertext moved to another id and a tampered byte (T4-04)', async () => {
    // Se crean tres casos independientes.
    const harness = makeHarness();
    await initializeVault(harness);

    const first = await harness.repository.create(NEW_CASE);
    const second = await harness.repository.create(NEW_CASE);
    const third = await harness.repository.create(NEW_CASE);

    const firstRow = await harness.db.cases.get(first.id);
    const secondRow = await harness.db.cases.get(second.id);
    const thirdRow = await harness.db.cases.get(third.id);

    if (firstRow === undefined || secondRow === undefined || thirdRow === undefined) {
      throw new Error('Expected three case rows');
    }

    // Mover el ciphertext de otro id cambia el AAD y debe fallar la autenticación.
    await harness.db.cases.put({ ...secondRow, ct: new Uint8Array(firstRow.ct) });
    await expect(harness.repository.get(second.id)).rejects.toBeInstanceOf(CorruptDataError);

    // Alterar un solo byte del ciphertext también debe fallar.
    const tamperedCt = new Uint8Array(thirdRow.ct);
    tamperedCt[0] = (tamperedCt[0] ?? 0) ^ 0xff;
    await harness.db.cases.put({ ...thirdRow, ct: tamperedCt });
    await expect(harness.repository.get(third.id)).rejects.toBeInstanceOf(CorruptDataError);

    // El caso intacto sigue siendo legible.
    await expect(harness.repository.get(first.id)).resolves.toEqual(first);
  });

  it('changes the PIN without re-encrypting case rows (T4-05)', async () => {
    // Se crea un caso con la DEK original.
    const harness = makeHarness();
    await initializeVault(harness);
    const created = await harness.repository.create(NEW_CASE);

    // Se copian las filas antes del cambio de PIN.
    const rowsBefore = await harness.db.cases.toArray();

    // Cambiar el PIN solo re-envuelve la DEK.
    await harness.keyring.changePin(PIN, NEW_PIN);

    // Las filas de casos no cambian ni un byte.
    await expect(harness.db.cases.toArray()).resolves.toEqual(rowsBefore);

    // El caso sigue legible sin re-cifrarse.
    await expect(harness.repository.get(created.id)).resolves.toEqual(created);

    // El PIN nuevo abre el mismo contenido y el viejo ya no.
    harness.keyring.lock();
    await expect(harness.keyring.unlock(PIN)).rejects.toBeInstanceOf(IncorrectPinError);
    await harness.keyring.unlock(NEW_PIN);
    await expect(harness.repository.get(created.id)).resolves.toEqual(created);
  });

  it('updates a case and advances its ordering timestamp', async () => {
    // Se actualiza una banda con justificación válida.
    const harness = makeHarness();
    await initializeVault(harness);
    const created = await harness.repository.create(NEW_CASE);

    const justified: ScreeningEntry = {
      ...SCREENING,
      finalBand: 'moderate',
      justification: 'Revisión clínica sintética',
    };

    const updated = await harness.repository.update(created.id, (current) => ({
      ...current,
      screenings: [justified],
    }));

    expect(updated.screenings).toEqual([justified]);
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
    await expect(harness.repository.get(created.id)).resolves.toEqual(updated);
  });

  it('rejects immutable fields and missing justifications (T4-07)', async () => {
    // Se prepara un caso con bandas iguales y sin justificación.
    const harness = makeHarness();
    await initializeVault(harness);
    const created = await harness.repository.create(NEW_CASE);

    const rowBefore = await harness.db.cases.get(created.id);

    // Código, fecha de creación y consentimiento son inmutables.
    await expect(
      harness.repository.update(created.id, (current) => ({ ...current, code: 'AAAA-AAAA' })),
    ).rejects.toBeInstanceOf(ImmutableFieldError);

    await expect(
      harness.repository.update(created.id, (current) => ({
        ...current,
        createdAt: '2026-10-28T20:00:00Z',
      })),
    ).rejects.toBeInstanceOf(ImmutableFieldError);

    await expect(
      harness.repository.update(created.id, (current) => ({
        ...current,
        consent: { ...current.consent, textVersion: 'sample-2' },
      })),
    ).rejects.toBeInstanceOf(ImmutableFieldError);

    // Una mutación en sitio también se detecta porque los inmutables se copian antes.
    await expect(
      harness.repository.update(created.id, (current) => {
        current.code = 'AAAA-AAAA';
        return current;
      }),
    ).rejects.toBeInstanceOf(ImmutableFieldError);

    // Cambiar la banda sin justificar incumple la invariante del modelo.
    await expect(
      harness.repository.update(created.id, (current) => ({
        ...current,
        screenings: [{ ...SCREENING, finalBand: 'severe', justification: null }],
      })),
    ).rejects.toBeInstanceOf(InvalidCaseDataError);

    // Una justificación de solo espacios tampoco es válida.
    await expect(
      harness.repository.update(created.id, (current) => ({
        ...current,
        screenings: [{ ...SCREENING, finalBand: 'severe', justification: '   ' }],
      })),
    ).rejects.toBeInstanceOf(InvalidCaseDataError);

    // Ninguna actualización rechazada modificó la fila original.
    await expect(harness.db.cases.get(created.id)).resolves.toEqual(rowBefore);
  });

  it('rejects updates for a missing case', async () => {
    // Un id inexistente no debe crear una fila nueva.
    const harness = makeHarness();
    await initializeVault(harness);

    await expect(
      harness.repository.update('00000000-0000-4000-8000-000000000000', (current) => current),
    ).rejects.toBeInstanceOf(CaseNotFoundError);
  });

  it('lets one concurrent update win without losing changes (T4-08)', async () => {
    // Se crea el caso con una DEK desbloqueada.
    const harness = makeHarness();
    await initializeVault(harness);
    const created = await harness.repository.create(NEW_CASE);

    // La barrera asegura que las dos actualizaciones leen la misma versión antes de escribir.
    const synchronizedKeyring = synchronizeDecrypts(harness.keyring, 2);
    const repository = createCaseRepository({ db: harness.db, keyring: synchronizedKeyring });

    const firstUpdate = repository.update(created.id, (current) => ({
      ...current,
      screenings: [
        {
          ...SCREENING,
          finalBand: 'moderate',
          justification: 'Primera actualización sintética',
        },
      ],
    }));

    const secondUpdate = repository.update(created.id, (current) => ({
      ...current,
      screenings: [
        {
          ...SCREENING,
          finalBand: 'severe',
          justification: 'Segunda actualización sintética',
        },
      ],
    }));

    const results = await Promise.allSettled([firstUpdate, secondUpdate]);

    // Una gana y la otra detecta la modificación concurrente.
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<CaseRecord> => result.status === 'fulfilled',
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(ConcurrentModificationError);

    // El estado final conserva exactamente la actualización que ganó.
    const winner = fulfilled[0]?.value;
    if (winner === undefined) {
      throw new Error('Expected one successful update');
    }

    await expect(repository.get(created.id)).resolves.toEqual(winner);
  });

  it('lists ordered pages and decrypts only the page (T4-09)', async () => {
    // Se siembran mil casos sintéticos con marcas de actualización 0..999.
    const harness = makeHarness();
    await initializeVault(harness);
    await seedCases(harness.db, harness.keyring, 1_000);

    // Se añade una fila con ciphertext corrupto como la más reciente.
    const corruptId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    await harness.db.cases.put({
      id: corruptId,
      v: CRYPTO_FORMAT_VERSION,
      iv: new Uint8Array(12),
      ct: new Uint8Array([1, 2, 3]),
      actualizadoEn: 1_000,
    });

    // Se envuelve el llavero para contar los descifrados.
    const counted = countDecrypts(harness.keyring);
    const repository = createCaseRepository({ db: harness.db, keyring: counted.keyring });

    const firstPage = await repository.list({ limit: 10 });

    // Solo se intentaron descifrar las diez filas de la página.
    expect(counted.count()).toBe(10);

    // La fila corrupta se informa sin abortar el resto del listado.
    expect(firstPage.unreadableIds).toEqual([corruptId]);
    expect(firstPage.items.map((item) => item.updatedAt)).toEqual(
      Array.from({ length: 9 }, (_value, index) => 999 - index),
    );

    const secondPage = await repository.list({ limit: 10, offset: 10 });

    // La segunda página continúa el orden descendente y solo descifra diez más.
    expect(counted.count()).toBe(20);
    expect(secondPage.unreadableIds).toEqual([]);
    expect(secondPage.items.map((item) => item.updatedAt)).toEqual(
      Array.from({ length: 10 }, (_value, index) => 990 - index),
    );

    // El máximo de página es 100, aunque se pida más.
    const maxPage = await repository.list({ limit: 500 });
    expect(counted.count()).toBe(120);
    expect(maxPage.items).toHaveLength(99);
    expect(maxPage.unreadableIds).toEqual([corruptId]);

    // El contador no descifra y ve las 1.001 filas.
    await expect(repository.count()).resolves.toBe(1_001);
  });
});
