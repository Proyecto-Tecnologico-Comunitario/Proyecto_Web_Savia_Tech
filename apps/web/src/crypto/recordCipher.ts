// SPDX-License-Identifier: GPL-3.0-or-later

import {
  AAD_SEPARATOR,
  AES_GCM_IV_LENGTH_BYTES,
  AES_GCM_TAG_LENGTH_BITS,
  CRYPTO_FORMAT_VERSION,
  DATA_KEY_ALGORITHM,
} from './constants';
import { CorruptDataError, UnsupportedVersionError } from './errors';
import { getRandomBytes, getWebCrypto, toBufferSource } from './webcrypto';

/**
 * Registro tal como se persiste en IndexedDB.
 *
 * `id` queda en claro porque se usa como índice y como parte del AAD. El resto del contenido sensible
 * vive dentro de `ct`. `actualizadoEn` es metadato de ordenación y no está autenticado.
 */
export interface EncryptedRecord {
  /** Identificador estable del registro; entra en el AAD. */
  id: string;
  /** Versión del formato cifrado; entra en el AAD. */
  v: number;
  /** IV aleatorio de 12 bytes, único por escritura. */
  iv: Uint8Array;
  /** Texto cifrado más el tag de autenticación. */
  ct: Uint8Array;
  /** Marca temporal de la última escritura; no es sensible. */
  actualizadoEn: number;
}

/** Comprueba que un fragmento del AAD no esté vacío ni contenga el separador. */
function assertAadSegment(value: string, label: string): void {
  // Un separador dentro de un campo permitiría colisiones entre combinaciones distintas.
  if (value.length === 0 || value.includes(AAD_SEPARATOR)) {
    throw new TypeError(`${label} must be non-empty and must not contain "${AAD_SEPARATOR}"`);
  }
}

/**
 * Construye el AAD determinista de un registro.
 *
 * Vincular tabla, identificador y versión impide mover el ciphertext a otra tabla, a otro id o a otra
 * versión sin que falle la autenticación de AES-GCM.
 */
export function buildAad(table: string, id: string, version: number): string {
  // La tabla es un nombre interno y no puede contener el separador.
  assertAadSegment(table, 'Table');

  // El identificador se genera en la app y tampoco puede contener el separador.
  assertAadSegment(id, 'Record id');

  // La versión debe ser un entero positivo.
  if (!Number.isInteger(version) || version <= 0) {
    throw new TypeError('Version must be a positive integer');
  }

  // Se concatenan los tres campos en un orden fijo.
  return [table, id, String(version)].join(AAD_SEPARATOR);
}

/**
 * Cifra un objeto con AES-GCM y un IV nuevo.
 *
 * La DEK debe ser una clave AES-GCM no extraíble. El objeto se serializa como JSON UTF-8.
 */
export async function encryptRecord<T>(
  dataKey: CryptoKey,
  table: string,
  id: string,
  value: T,
  updatedAt: number = Date.now(),
): Promise<EncryptedRecord> {
  // La marca temporal debe ser un entero no negativo.
  if (!Number.isInteger(updatedAt) || updatedAt < 0) {
    throw new RangeError('updatedAt must be a non-negative integer');
  }

  // Se valida el contexto antes de generar un IV que luego no podría reutilizarse.
  const aad = toBufferSource(new TextEncoder().encode(buildAad(table, id, CRYPTO_FORMAT_VERSION)));

  // Cada escritura recibe un IV aleatorio nuevo de 12 bytes.
  const iv = getRandomBytes(AES_GCM_IV_LENGTH_BYTES);

  // El contenido se serializa como JSON antes de convertirlo a UTF-8.
  const serialized = JSON.stringify(value);

  // `undefined` no produce JSON y debe rechazarse antes de cifrar.
  if (serialized === undefined) {
    throw new TypeError('Value must be JSON-serializable');
  }

  // El JSON se convierte a bytes UTF-8 para cifrarlo.
  const plaintext = new TextEncoder().encode(serialized);

  try {
    // Se cifra con AES-GCM, tag de 128 bits y AAD autenticado.
    const ciphertext = await getWebCrypto().subtle.encrypt(
      {
        name: DATA_KEY_ALGORITHM,
        iv,
        additionalData: aad,
        tagLength: AES_GCM_TAG_LENGTH_BITS,
      },
      dataKey,
      plaintext,
    );

    // Se construye el registro con el formato persistido.
    return {
      id,
      v: CRYPTO_FORMAT_VERSION,
      iv,
      ct: new Uint8Array(ciphertext),
      actualizadoEn: updatedAt,
    };
  } finally {
    // Se sobrescribe la copia local del texto plano; el string JSON original no se puede borrar.
    plaintext.fill(0);
  }
}

/**
 * Descifra un registro y comprueba su contexto.
 *
 * El llamador debe aportar el `id` esperado desde el índice, no confiar en `record.id`. Así, cambiar el
 * identificador en el objeto persistido no permite saltarse el AAD.
 */
export async function decryptRecord<T>(
  dataKey: CryptoKey,
  table: string,
  expectedId: string,
  record: EncryptedRecord,
): Promise<T> {
  // El registro puede venir de IndexedDB, así que se comprueba también en tiempo de ejecución.
  if (typeof record !== 'object' || record === null) {
    throw new CorruptDataError();
  }

  // La versión debe ser un entero antes de decidir si está soportada.
  if (!Number.isInteger(record.v)) {
    throw new CorruptDataError();
  }

  // Solo se acepta el formato conocido; una versión futura necesita una migración explícita.
  if (record.v !== CRYPTO_FORMAT_VERSION) {
    throw new UnsupportedVersionError(record.v);
  }

  // El identificador del registro debe coincidir con el que espera el índice.
  if (record.id !== expectedId) {
    throw new CorruptDataError();
  }

  // El IV debe tener exactamente 12 bytes.
  if (!(record.iv instanceof Uint8Array) || record.iv.length !== AES_GCM_IV_LENGTH_BYTES) {
    throw new CorruptDataError();
  }

  // El ciphertext no puede estar vacío.
  if (!(record.ct instanceof Uint8Array) || record.ct.length === 0) {
    throw new CorruptDataError();
  }

  // El AAD se reconstruye con el contexto esperado y la versión autenticada.
  const aad = toBufferSource(new TextEncoder().encode(buildAad(table, expectedId, record.v)));

  let plaintext: ArrayBuffer;

  try {
    // Se descifra y se verifica el tag con el AAD reconstruido.
    plaintext = await getWebCrypto().subtle.decrypt(
      {
        name: DATA_KEY_ALGORITHM,
        iv: toBufferSource(record.iv),
        additionalData: aad,
        tagLength: AES_GCM_TAG_LENGTH_BITS,
      },
      dataKey,
      toBufferSource(record.ct),
    );
  } catch {
    // Cualquier fallo de autenticación se expone como dato corrupto, sin detalles internos.
    throw new CorruptDataError();
  }

  try {
    // Se decodifica el JSON autenticado.
    const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));

    // El tipo lo garantiza el llamador al cifrar; el contenido ya está autenticado.
    return parsed as T;
  } catch {
    // Un JSON inválido solo puede venir de datos corruptos o de un uso incorrecto del tipo.
    throw new CorruptDataError();
  } finally {
    // Se sobrescribe la copia local del texto plano descifrado.
    new Uint8Array(plaintext).fill(0);
  }
}
