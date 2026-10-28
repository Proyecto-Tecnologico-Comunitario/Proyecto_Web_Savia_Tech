// SPDX-License-Identifier: GPL-3.0-or-later

import 'fake-indexeddb/auto';

import Dexie, { type Table } from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { CRYPTO_METADATA_KEY } from '../../crypto/constants';
import { createKeyring } from '../../crypto/keyring';
import type { CryptoMetadata, CryptoMetadataStore } from '../../crypto/metadata';
import type { CasePayload } from '../../model/case';
import { createCaseRepository } from '../caseRepository';
import { DexieCryptoMetadataStore } from '../cryptoMetadataStore';
import { type CryptoMetadataRow, SaviaDatabase } from '../db';

/** Iteraciones bajas: solo reducen el coste del KDF durante las pruebas. */
const TEST_ITERATIONS = 1_000;

/** PIN sintético de prueba. */
const PIN = '123456';

/** Caso sintético válido; las horas son UTC y corresponden a la mañana en Colombia. */
const PAYLOAD: CasePayload = {
  code: 'K7QM-3XPA',
  synthetic: true,
  createdAt: '2026-10-28T19:03:00Z',
  consent: {
    textVersion: 'sample-1',
    timestamp: '2026-10-28T19:02:00Z',
  },
  screenings: [
    {
      instrumentId: 'phq9-sample',
      instrumentVersion: '0.1',
      answers: [0, 1, 2, 1, 0, 1, 0, 0, 0],
      score: 5,
      computedBand: 'mild',
      finalBand: 'mild',
      justification: null,
      safetyAlert: false,
      timestamp: '2026-10-28T19:10:00Z',
    },
  ],
};

/** Bases abiertas que deben cerrarse y eliminarse después de cada prueba. */
const databases = new Set<Dexie>();

/** Contador para aislar cada base de datos. */
let databaseCounter = 0;

/** Genera un nombre único de base de datos de prueba. */
function nextDatabaseName(): string {
  // El nombre no contiene datos personales.
  databaseCounter += 1;
  return `saviatech-test-migration-${databaseCounter}`;
}

/**
 * Réplica de la base en versión 1.
 *
 * Dexie decide la migración según la versión persistida, no según las clases actuales. Para simular
 * una instalación anterior se abre esta base con el esquema antiguo y luego se reabre con
 * `SaviaDatabase`, que ya declara la versión 2.
 */
class LegacyV1Database extends Dexie {
  /** Tabla de metadatos tal como existía en T3. */
  cryptoMetadata!: Table<CryptoMetadataRow, string>;

  constructor(name: string) {
    // Mismo nombre de base que usa la app, pero con el esquema de la versión 1.
    super(name);
    this.version(1).stores({ cryptoMetadata: '&key' });
  }
}

/** Adaptador mínimo sobre la base antigua para inicializar el llavero. */
function createLegacyMetadataStore(db: LegacyV1Database): CryptoMetadataStore {
  return {
    load: async (): Promise<CryptoMetadata | null> => {
      const row = await db.cryptoMetadata.get(CRYPTO_METADATA_KEY);
      return row?.value ?? null;
    },
    save: async (metadata: CryptoMetadata): Promise<void> => {
      await db.cryptoMetadata.put({ key: CRYPTO_METADATA_KEY, value: metadata });
    },
  };
}

afterEach(async () => {
  // Primero se cierran todas las conexiones, incluidas las que comparten nombre.
  for (const db of databases) {
    db.close();
  }

  // Después se eliminan las bases para dejar fake-indexeddb limpio.
  for (const db of databases) {
    await db.delete();
  }

  databases.clear();
});

describe('SaviaDatabase migration', () => {
  it('upgrades a version 1 vault to version 2 without losing metadata', async () => {
    // Se crea una instalación antigua con el llavero ya inicializado.
    const name = nextDatabaseName();
    const legacy = new LegacyV1Database(name);
    databases.add(legacy);

    const legacyStore = createLegacyMetadataStore(legacy);
    const legacyKeyring = createKeyring({
      store: legacyStore,
      iterations: TEST_ITERATIONS,
      minimumIterations: TEST_ITERATIONS,
    });
    await legacyKeyring.initialize(PIN);

    // Se conserva una copia de los metadatos antes de migrar.
    const metadataBefore = await legacyStore.load();
    if (metadataBefore === null) {
      throw new Error('Expected metadata before migration');
    }

    // Se cierra la conexión antigua para que Dexie pueda aplicar la versión 2.
    legacy.close();

    // La app abre la misma base con el esquema nuevo.
    const migrated = new SaviaDatabase(name);
    databases.add(migrated);
    await migrated.open();

    // La migración crea la tabla de casos y conserva la de metadatos.
    expect(migrated.verno).toBe(2);
    expect(migrated.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining(['cryptoMetadata', 'cases']),
    );

    // La fila de metadatos no cambia: salt, DEK envuelta y contadores siguen intactos.
    const migratedStore = new DexieCryptoMetadataStore(migrated);
    const metadataAfter = await migratedStore.load();
    expect(metadataAfter).toEqual(metadataBefore);

    // El mismo PIN vuelve a desbloquear la DEK tras la migración.
    const keyring = createKeyring({
      store: migratedStore,
      iterations: TEST_ITERATIONS,
      minimumIterations: TEST_ITERATIONS,
    });
    expect(await keyring.load()).toBe('locked');
    await keyring.unlock(PIN);
    expect(keyring.getState()).toBe('unlocked');

    // El repositorio puede crear y recuperar casos sobre la base ya migrada.
    const repository = createCaseRepository({ db: migrated, keyring });
    const created = await repository.create({
      consent: PAYLOAD.consent,
      synthetic: PAYLOAD.synthetic,
      screenings: PAYLOAD.screenings,
    });

    // La marca sintética y el contenido clínico se conservan.
    expect(created.synthetic).toBe(true);
    expect(created.screenings).toEqual(PAYLOAD.screenings);

    // La lectura posterior confirma que la DEK migrada sigue sirviendo para descifrar.
    await expect(repository.get(created.id)).resolves.toEqual(created);
    await expect(repository.list()).resolves.toEqual({
      items: [created],
      unreadableIds: [],
    });
  });
});
