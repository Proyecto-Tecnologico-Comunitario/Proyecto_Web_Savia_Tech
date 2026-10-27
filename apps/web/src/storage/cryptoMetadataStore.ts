// SPDX-License-Identifier: GPL-3.0-or-later

import { CRYPTO_METADATA_KEY } from '../crypto/constants';
import { CorruptDataError } from '../crypto/errors';
import type { CryptoMetadata, CryptoMetadataStore } from '../crypto/metadata';
import { saviaDatabase, type SaviaDatabase } from './db';

/**
 * Adaptador de metadatos sobre Dexie.
 *
 * Esta capa conoce IndexedDB, pero no conoce WebCrypto: recibe y devuelve datos ya preparados por el
 * llavero. Así se mantiene la separación entre persistencia y criptografía.
 */
export class DexieCryptoMetadataStore implements CryptoMetadataStore {
  private readonly db: SaviaDatabase;

  constructor(db: SaviaDatabase = saviaDatabase) {
    // Se permite inyectar la base para aislar las pruebas.
    this.db = db;
  }

  async load(): Promise<CryptoMetadata | null> {
    // Se busca el único registro de metadatos.
    const row = await this.db.cryptoMetadata.get(CRYPTO_METADATA_KEY);

    // La ausencia de fila significa que el almacén no está inicializado.
    if (row === undefined) {
      return null;
    }

    // Una fila existente sin valor está corrupta y no debe confundirse con un almacén vacío.
    if (row.value === undefined || row.value === null) {
      throw new CorruptDataError();
    }

    return row.value;
  }

  async save(metadata: CryptoMetadata): Promise<void> {
    // `put` crea o reemplaza el registro completo de forma atómica.
    await this.db.cryptoMetadata.put({ key: CRYPTO_METADATA_KEY, value: metadata });
  }
}

/** Instancia compartida por la app. */
export const cryptoMetadataStore = new DexieCryptoMetadataStore();
