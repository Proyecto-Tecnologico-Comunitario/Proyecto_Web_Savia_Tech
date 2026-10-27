// SPDX-License-Identifier: GPL-3.0-or-later

import { CryptoUnavailableError } from './errors';

/**
 * Devuelve la implementación nativa de WebCrypto.
 *
 * Se comprueba en tiempo de ejecución porque la app puede abrirse en un contexto no seguro o en un
 * navegador antiguo. Nunca se usa una implementación criptográfica de terceros.
 */
export function getWebCrypto(): Crypto {
  // Se lee el objeto global del navegador o de Node 20+.
  const webCrypto = globalThis.crypto;

  // Sin `subtle` no hay primitivas criptográficas seguras disponibles.
  if (!webCrypto?.subtle) {
    throw new CryptoUnavailableError();
  }

  // Se devuelve la instancia nativa para usar sus primitivas.
  return webCrypto;
}

/**
 * Copia bytes a un buffer respaldado por `ArrayBuffer`.
 *
 * TypeScript 5.9 distingue entre `ArrayBuffer` y `SharedArrayBuffer`; WebCrypto exige el primero. Las
 * copias son pequeñas y solo se usan en los límites de la API nativa.
 */
export function toBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  // Se crea un buffer nuevo para no depender del tipo del buffer original.
  return new Uint8Array(bytes);
}

/** Genera bytes aleatorios con la fuente criptográfica del sistema. */
export function getRandomBytes(length: number): Uint8Array<ArrayBuffer> {
  // Se valida la longitud para evitar arrays vacíos o negativos por error.
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError('Random byte length must be a positive integer');
  }

  // WebCrypto es la única fuente de aleatoriedad permitida.
  const webCrypto = getWebCrypto();

  // Se reserva el buffer que recibirá los bytes aleatorios.
  const bytes = new Uint8Array(length);

  // `getRandomValues` llena el buffer de forma criptográficamente segura.
  webCrypto.getRandomValues(bytes);

  // Se devuelve el buffer ya lleno.
  return bytes;
}
