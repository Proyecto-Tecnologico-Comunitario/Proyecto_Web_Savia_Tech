// SPDX-License-Identifier: GPL-3.0-or-later

import Dexie, { type Table } from 'dexie';

import type { CryptoMetadata } from '../crypto/metadata';

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
 * T3 crea solo la tabla de metadatos. Las tablas de casos se añadirán en T4 con una nueva versión de
 * Dexie, sin cambiar el nombre de la base de datos.
 */
export class SaviaDatabase extends Dexie {
  /** Tabla de metadatos del cifrado. */
  cryptoMetadata!: Table<CryptoMetadataRow, string>;

  constructor(name: string = 'saviatech') {
    // Se inicializa la base con el nombre recibido; las pruebas usan nombres aislados.
    super(name);

    // La clave primaria es la clave fija de la fila.
    this.version(1).stores({ cryptoMetadata: '&key' });
  }
}

/** Instancia compartida por la app. */
export const saviaDatabase = new SaviaDatabase();
