// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Parámetros criptográficos centralizados.
 *
 * No se permiten números mágicos dispersos: cualquier cambio de parámetro debe hacerse aquí y quedar
 * reflejado en el README del módulo y en el ADR correspondiente.
 */

/** Versión del formato de registro cifrado y del AAD. */
export const CRYPTO_FORMAT_VERSION = 1;

/**
 * Iteraciones mínimas aceptadas para PBKDF2-HMAC-SHA256 (referencia OWASP).
 *
 * Es un suelo de compatibilidad: subir `PBKDF2_ITERATIONS` no debe invalidar almacenes antiguos que
 * todavía cumplen el mínimo.
 */
export const PBKDF2_MIN_ITERATIONS = 600_000;

/** Iteraciones usadas al crear un almacén nuevo. */
export const PBKDF2_ITERATIONS = PBKDF2_MIN_ITERATIONS;

/** Hash usado por PBKDF2. */
export const PBKDF2_HASH = 'SHA-256';

/** Longitud de la sal aleatoria de PBKDF2, en bytes. */
export const SALT_LENGTH_BYTES = 16;

/** Longitud mínima del PIN: seis dígitos. */
export const PIN_MIN_LENGTH = 6;

/** Longitud de las claves AES, en bits. */
export const AES_KEY_LENGTH_BITS = 256;

/**
 * Longitud de la DEK envuelta con AES-KW, en bytes.
 *
 * AES-KW añade 8 bytes de integridad a la clave de 256 bits. Un valor distinto indica metadatos
 * corruptos antes de intentar derivar la KEK.
 */
export const WRAPPED_DATA_KEY_LENGTH_BYTES = AES_KEY_LENGTH_BITS / 8 + 8;

/** Longitud del IV de AES-GCM, en bytes. */
export const AES_GCM_IV_LENGTH_BYTES = 12;

/** Longitud del tag de autenticación de AES-GCM, en bits. */
export const AES_GCM_TAG_LENGTH_BITS = 128;

/** Algoritmo usado para envolver la DEK con la KEK. */
export const KEK_ALGORITHM = 'AES-KW';

/** Algoritmo usado para cifrar cada registro. */
export const DATA_KEY_ALGORITHM = 'AES-GCM';

/** Separador del AAD. Las tablas e identificadores no pueden contenerlo. */
export const AAD_SEPARATOR = '|';

/**
 * Espera acumulada tras cada fallo de PIN.
 *
 * El índice es el número de fallos menos uno. Los dos primeros no añaden espera; después crece hasta
 * cinco minutos. Esta espera frena la fuerza bruta dentro de la app, pero no un ataque offline.
 */
export const LOCKOUT_DELAYS_MS = [0, 0, 5_000, 30_000, 300_000] as const;

/** Clave del único registro de metadatos en la tabla de Dexie. */
export const CRYPTO_METADATA_KEY = 'vault';
