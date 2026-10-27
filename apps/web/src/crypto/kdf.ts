// SPDX-License-Identifier: GPL-3.0-or-later

import {
  AES_KEY_LENGTH_BITS,
  KEK_ALGORITHM,
  PBKDF2_HASH,
  PBKDF2_ITERATIONS,
  SALT_LENGTH_BYTES,
} from './constants';
import { getRandomBytes, getWebCrypto, toBufferSource } from './webcrypto';

/**
 * Genera un salt aleatoria de 16 bytes para PBKDF2.
 *
 * El salt se guarda junto a los metadatos. Su objetivo es que dos instalaciones con el mismo PIN
 * produzcan claves distintas.
 */
export function generateSalt(): Uint8Array<ArrayBuffer> {
  // Se delega toda la aleatoriedad en WebCrypto.
  return getRandomBytes(SALT_LENGTH_BYTES);
}

/**
 * Deriva los 256 bits de la KEK con PBKDF2-HMAC-SHA256.
 *
 * Se expone por separado para poder comprobar un vector conocido en las pruebas. En producción se usa
 * `deriveKek`, que convierte estos bits en una `CryptoKey` no extraíble.
 */
export async function deriveKekBits(
  pin: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<ArrayBuffer> {
  // Se comprueba que el salt tenga contenido antes de derivar.
  if (salt.length === 0) {
    throw new RangeError('PBKDF2 salt must not be empty');
  }

  // El número de iteraciones debe ser un entero positivo.
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new RangeError('PBKDF2 iterations must be a positive integer');
  }

  // Se obtiene la implementación nativa de WebCrypto.
  const subtle = getWebCrypto().subtle;

  // El PIN se convierte a UTF-8; la política ya limita su contenido a dígitos.
  const pinBytes = new TextEncoder().encode(pin);

  try {
    // Se importa el PIN como material de PBKDF2, sin posibilidad de exportarlo.
    const pinKey = await subtle.importKey('raw', pinBytes, 'PBKDF2', false, ['deriveBits']);

    // Se derivan exactamente 256 bits con el hash y el salt indicados.
    return await subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: PBKDF2_HASH,
        salt: toBufferSource(salt),
        iterations,
      },
      pinKey,
      AES_KEY_LENGTH_BITS,
    );
  } finally {
    // Se sobrescribe la copia local del PIN; no se puede garantizar el borrado físico de la memoria.
    pinBytes.fill(0);
  }
}

/**
 * Deriva la KEK y la deja como `CryptoKey` AES-KW no extraíble.
 *
 * La KEK solo puede envolver y desenvolver la DEK. Al ser no extraíble, el código de la app no puede
 * leer sus bytes.
 */
export async function deriveKek(
  pin: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  // El salt persistida debe tener exactamente el tamaño definido por el formato.
  if (salt.length !== SALT_LENGTH_BYTES) {
    throw new RangeError('Invalid PBKDF2 salt length');
  }

  // Se derivan los bits con la función de bajo nivel.
  const bits = await deriveKekBits(pin, salt, iterations);

  try {
    // Se importan los bits como clave AES-KW no extraíble.
    return await getWebCrypto().subtle.importKey(
      'raw',
      bits,
      { name: KEK_ALGORITHM, length: AES_KEY_LENGTH_BITS },
      false,
      ['wrapKey', 'unwrapKey'],
    );
  } finally {
    // Se sobrescribe la copia temporal de la KEK; la `CryptoKey` ya no depende de este buffer.
    new Uint8Array(bits).fill(0);
  }
}
