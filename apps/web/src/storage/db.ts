// SPDX-License-Identifier: GPL-3.0-or-later

import Dexie, { type Table } from 'dexie';

import type { CryptoMetadata } from '../crypto/metadata';
import type { EncryptedRecord } from '../crypto/recordCipher';

/** Fila única que guarda los metadatos del llavero. */
export interface CryptoMetadataRow {
  /** Clave fija; solo existe una fila de metadatos. */
  key: string;
  /** Metadatos sin PIN, KEK ni DEK en claro. */
  value: CryptoMetadata;
}

/**
 * Base local de SaviaTech.
 *
 * T3 creó la tabla de metadatos y T4 añade la tabla de casos con una nueva versión de Dexie, sin
 * cambiar el nombre de la base. La migración de la versión 1 a la 2 solo crea `cases`; Dexie conserva
 * la fila de `cryptoMetadata` sin modificarla.
 */
export class SaviaDatabase extends Dexie {
  /** Tabla de metadatos del cifrado. */
  cryptoMetadata!: Table<CryptoMetadataRow, string>;

  /** Tabla de casos cifrados; solo `id` y `actualizadoEn` quedan en claro. */
  cases!: Table<EncryptedRecord, string>;

  constructor(name: string = 'saviatech') {
    // Se inicializa la base con el nombre recibido; las pruebas usan nombres aislados.
    super(name);

    // La clave primaria es la clave fija de la fila.
    this.version(1).stores({ cryptoMetadata: '&key' });

    // La versión 2 añade los casos y mantiene la tabla de metadatos existente.
    // El índice `actualizadoEn` permite listar los más recientes sin leer todos los registros.
    this.version(2).stores({
      cryptoMetadata: '&key',
      cases: '&id, actualizadoEn',
    });
  }
}

/** Instancia compartida por la app. */
export const saviaDatabase = new SaviaDatabase();
