// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { CRYPTO_FORMAT_VERSION } from '../constants';
import { CorruptDataError, UnsupportedVersionError } from '../errors';
import { buildAad, decryptRecord, encryptRecord } from '../recordCipher';
import { getWebCrypto } from '../webcrypto';

/** Crea una DEK sintética para las pruebas de cifrado. */
async function createDataKey(): Promise<CryptoKey> {
  // La clave se genera no extraíble, igual que la DEK real.
  return getWebCrypto().subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

describe('recordCipher', () => {
  it('round-trips an object', async () => {
    // Se prepara una DEK y un contenido sintético.
    const dataKey = await createDataKey();
    const value = { code: 'K7QM-3XPA', synthetic: true, answers: [0, 1, 2, 3] };

    // Se cifra y se descifra con el mismo contexto.
    const record = await encryptRecord(dataKey, 'cases', 'case-1', value, 1_000);
    const decrypted = await decryptRecord(dataKey, 'cases', 'case-1', record);

    // El objeto debe conservarse íntegro.
    expect(decrypted).toEqual(value);

    // La marca temporal se guarda en claro y no se modifica.
    expect(record.actualizadoEn).toBe(1_000);

    // El IV tiene exactamente el tamaño exigido por AES-GCM.
    expect(record.iv).toHaveLength(12);

    // La versión del registro sigue el formato actual.
    expect(record.v).toBe(CRYPTO_FORMAT_VERSION);
  });

  it('uses a new IV for every encryption', async () => {
    // La misma clave y el mismo contenido se cifran dos veces.
    const dataKey = await createDataKey();
    const value = { synthetic: true, note: 'same content' };
    const first = await encryptRecord(dataKey, 'cases', 'case-1', value, 1);
    const second = await encryptRecord(dataKey, 'cases', 'case-1', value, 2);

    // Un IV repetido rompería AES-GCM.
    expect(first.iv).not.toEqual(second.iv);

    // Al cambiar el IV, el ciphertext también debe cambiar.
    expect(first.ct).not.toEqual(second.ct);
  });

  it('rejects a tampered ciphertext or IV', async () => {
    // Se prepara un registro válido.
    const dataKey = await createDataKey();
    const record = await encryptRecord(dataKey, 'cases', 'case-1', { synthetic: true }, 1);

    // Se altera un byte del ciphertext manteniendo el resto.
    const tamperedCiphertext = {
      ...record,
      ct: Uint8Array.from(record.ct),
    };
    tamperedCiphertext.ct[0] = (tamperedCiphertext.ct[0] ?? 0) ^ 0xff;

    // El tag de AES-GCM debe detectar la manipulación.
    await expect(
      decryptRecord(dataKey, 'cases', 'case-1', tamperedCiphertext),
    ).rejects.toBeInstanceOf(CorruptDataError);

    // Se altera ahora el IV.
    const tamperedIv = {
      ...record,
      iv: Uint8Array.from(record.iv),
    };
    tamperedIv.iv[0] = (tamperedIv.iv[0] ?? 0) ^ 0xff;

    // Un IV distinto produce otra autenticación y debe fallar.
    await expect(decryptRecord(dataKey, 'cases', 'case-1', tamperedIv)).rejects.toBeInstanceOf(
      CorruptDataError,
    );
  });

  it('binds the record to its table, id and version', async () => {
    // Se prepara un registro válido.
    const dataKey = await createDataKey();
    const record = await encryptRecord(dataKey, 'cases', 'case-1', { synthetic: true }, 1);

    // Cambiar la tabla cambia el AAD.
    await expect(decryptRecord(dataKey, 'notes', 'case-1', record)).rejects.toBeInstanceOf(
      CorruptDataError,
    );

    // Cambiar el id esperado también cambia el AAD.
    await expect(decryptRecord(dataKey, 'cases', 'case-2', record)).rejects.toBeInstanceOf(
      CorruptDataError,
    );

    // Mover el registro a otro id tampoco debe funcionar, aunque el campo también cambie.
    await expect(
      decryptRecord(dataKey, 'cases', 'case-2', { ...record, id: 'case-2' }),
    ).rejects.toBeInstanceOf(CorruptDataError);

    // Una versión distinta no está soportada.
    await expect(
      decryptRecord(dataKey, 'cases', 'case-1', { ...record, v: 2 }),
    ).rejects.toBeInstanceOf(UnsupportedVersionError);
  });

  it('rejects a different key or malformed record', async () => {
    // Se cifra con una clave y se intenta descifrar con otra.
    const dataKey = await createDataKey();
    const otherKey = await createDataKey();
    const record = await encryptRecord(dataKey, 'cases', 'case-1', { synthetic: true }, 1);

    // Una clave distinta no puede autenticar el registro.
    await expect(decryptRecord(otherKey, 'cases', 'case-1', record)).rejects.toBeInstanceOf(
      CorruptDataError,
    );

    // Un IV con longitud incorrecta se rechaza antes de llamar a WebCrypto.
    await expect(
      decryptRecord(dataKey, 'cases', 'case-1', { ...record, iv: new Uint8Array(8) }),
    ).rejects.toBeInstanceOf(CorruptDataError);

    // Un ciphertext vacío también es inválido.
    await expect(
      decryptRecord(dataKey, 'cases', 'case-1', { ...record, ct: new Uint8Array() }),
    ).rejects.toBeInstanceOf(CorruptDataError);
  });

  it('round-trips unicode content', async () => {
    // Los textos clínicos pueden contener acentos y otros caracteres.
    const dataKey = await createDataKey();
    const value = { note: 'Ansiedad y sueño; datos sintéticos.' };
    const record = await encryptRecord(dataKey, 'cases', 'case-1', value, 1);
    const decrypted = await decryptRecord<typeof value>(dataKey, 'cases', 'case-1', record);

    // La codificación UTF-8 debe conservar el contenido.
    expect(decrypted).toEqual(value);
  });

  it('rejects ambiguous AAD segments', () => {
    // El separador no puede aparecer en la tabla ni en el id.
    expect(() => buildAad('ca|ses', 'case-1', 1)).toThrow(TypeError);
    expect(() => buildAad('cases', 'case|1', 1)).toThrow(TypeError);
  });
});
