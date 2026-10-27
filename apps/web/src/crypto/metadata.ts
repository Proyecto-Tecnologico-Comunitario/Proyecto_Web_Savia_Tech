// SPDX-License-Identifier: GPL-3.0-or-later

import {
  CRYPTO_FORMAT_VERSION,
  PBKDF2_HASH,
  PBKDF2_MIN_ITERATIONS,
  SALT_LENGTH_BYTES,
  WRAPPED_DATA_KEY_LENGTH_BYTES,
} from './constants';
import { CorruptDataError, UnsupportedVersionError } from './errors';

/**
 * Metadatos no secretos necesarios para desbloquear el almacén.
 *
 * No contienen PIN, KEK ni DEK en claro. La DEK solo aparece envuelta con la KEK. Aun así, estos
 * metadatos permiten un ataque offline contra el PIN si alguien copia IndexedDB.
 */
export interface CryptoMetadata {
  /** Versión del formato criptográfico. */
  v: number;
  /** Parámetros necesarios para volver a derivar la KEK. */
  kdf: {
    alg: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: Uint8Array;
  };
  /** DEK envuelta con AES-KW. */
  wrappedDataKey: Uint8Array;
  /** Fallos acumulados desde el último desbloqueo correcto. */
  failedAttempts: number;
  /** Instante mínimo del próximo intento, o `null` si no hay espera. */
  lockedUntil: number | null;
}

/** Contrato mínimo de persistencia que necesita el llavero. */
export interface CryptoMetadataStore {
  /** Devuelve los metadatos o `null` si el almacén aún no existe. */
  load(): Promise<CryptoMetadata | null>;
  /** Guarda los metadatos completos en un único registro. */
  save(metadata: CryptoMetadata): Promise<void>;
}

/** Comprueba que un valor desconocido es un objeto indexable. */
function isRecord(value: unknown): value is Record<string, unknown> {
  // Se exige un objeto que no sea `null` ni un array.
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Comprueba que un valor es un entero no negativo. */
function isNonNegativeInteger(value: unknown): value is number {
  // Se descartan decimales, infinitos, valores no seguros y valores negativos.
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Valida los metadatos leídos de la base de datos.
 *
 * La base de datos es un límite de confianza: un atacante con acceso al dispositivo puede modificarla.
 * Por eso no se confía en la forma TypeScript y se comprueba cada campo antes de usar la clave.
 */
export function parseCryptoMetadata(
  value: unknown,
  minimumIterations: number = PBKDF2_MIN_ITERATIONS,
): CryptoMetadata {
  // La raíz debe ser un objeto.
  if (!isRecord(value)) {
    throw new CorruptDataError();
  }

  // La versión debe ser un entero; si no, el dato está corrupto.
  if (!isNonNegativeInteger(value.v)) {
    throw new CorruptDataError();
  }

  // Una versión distinta necesita una ruta de migración que todavía no existe.
  if (value.v !== CRYPTO_FORMAT_VERSION) {
    throw new UnsupportedVersionError(value.v);
  }

  // Los parámetros KDF deben venir en un objeto.
  if (!isRecord(value.kdf)) {
    throw new CorruptDataError();
  }

  // Solo se acepta el algoritmo y el hash del formato actual.
  if (value.kdf.alg !== 'PBKDF2' || value.kdf.hash !== PBKDF2_HASH) {
    throw new CorruptDataError();
  }

  // Las iteraciones deben ser un entero positivo y no bajar del mínimo aceptado.
  if (
    !isNonNegativeInteger(value.kdf.iterations) ||
    value.kdf.iterations === 0 ||
    value.kdf.iterations < minimumIterations
  ) {
    throw new CorruptDataError();
  }

  // El salt debe ser un `Uint8Array` del tamaño exacto del formato.
  if (!(value.kdf.salt instanceof Uint8Array) || value.kdf.salt.length !== SALT_LENGTH_BYTES) {
    throw new CorruptDataError();
  }

  // La DEK envuelta debe tener exactamente el tamaño que produce AES-KW para una clave de 256 bits.
  if (
    !(value.wrappedDataKey instanceof Uint8Array) ||
    value.wrappedDataKey.length !== WRAPPED_DATA_KEY_LENGTH_BYTES
  ) {
    throw new CorruptDataError();
  }

  // El contador de fallos no puede ser negativo.
  if (!isNonNegativeInteger(value.failedAttempts)) {
    throw new CorruptDataError();
  }

  // `lockedUntil` solo puede ser `null` o una marca temporal no negativa.
  if (value.lockedUntil !== null && !isNonNegativeInteger(value.lockedUntil)) {
    throw new CorruptDataError();
  }

  // Se devuelve una copia para que el llavero no comparta arrays con el almacén.
  return {
    v: value.v,
    kdf: {
      alg: 'PBKDF2',
      hash: 'SHA-256',
      iterations: value.kdf.iterations,
      salt: new Uint8Array(value.kdf.salt),
    },
    wrappedDataKey: new Uint8Array(value.wrappedDataKey),
    failedAttempts: value.failedAttempts,
    lockedUntil: value.lockedUntil,
  };
}
