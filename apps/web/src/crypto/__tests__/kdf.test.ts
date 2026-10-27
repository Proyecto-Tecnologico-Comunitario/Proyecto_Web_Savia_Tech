// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { PBKDF2_ITERATIONS, SALT_LENGTH_BYTES } from '../constants';
import { deriveKek, deriveKekBits, generateSalt } from '../kdf';

/** Convierte bytes a hexadecimal para comparar vectores conocidos. */
function toHex(buffer: ArrayBuffer): string {
  // Cada byte se convierte a dos dígitos hexadecimales.
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('kdf', () => {
  it('matches the known PBKDF2-HMAC-SHA256 vector', async () => {
    // Vector publicado para contraseña "password", sal "salt" y una iteración.
    const bits = await deriveKekBits('password', new TextEncoder().encode('salt'), 1);

    // El resultado debe ser idéntico al vector de referencia.
    expect(toHex(bits)).toBe('120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b');
  });

  it('exports the OWASP iteration default', () => {
    // El valor debe cumplir el mínimo del requerimiento.
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  it('generates a fresh 16-byte salt', () => {
    // Dos sales no deben coincidir en la práctica.
    const first = generateSalt();
    const second = generateSalt();

    // El tamaño está fijado por el formato.
    expect(first).toHaveLength(SALT_LENGTH_BYTES);

    // La comparación protege contra una sal constante por error.
    expect(first).not.toEqual(second);
  });

  it('derives a non-extractable AES-KW key', async () => {
    // Se usa una sal válida y pocas iteraciones para mantener la prueba rápida.
    const salt = generateSalt();
    const key = await deriveKek('123456', salt, 1_000);

    // La KEK no puede exportarse.
    expect(key.extractable).toBe(false);

    // El algoritmo debe ser AES-KW de 256 bits.
    expect(key.algorithm).toMatchObject({ name: 'AES-KW', length: 256 });

    // Los únicos usos permitidos son envolver y desenvolver.
    expect([...key.usages].sort()).toEqual(['unwrapKey', 'wrapKey']);
  });

  it('rejects an empty salt or invalid iteration count', async () => {
    // La sal vacía no aporta entropía y debe rechazarse.
    await expect(deriveKekBits('123456', new Uint8Array(), 1_000)).rejects.toThrow(RangeError);

    // Cero iteraciones no es un parámetro válido.
    await expect(deriveKekBits('123456', generateSalt(), 0)).rejects.toThrow(RangeError);
  });

  it('rejects a salt with the wrong length for the KEK', async () => {
    // `deriveKek` solo acepta el tamaño persistido por el formato.
    await expect(deriveKek('123456', new Uint8Array(8), 1_000)).rejects.toThrow(RangeError);
  });
});
