// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { PBKDF2_ITERATIONS, WRAPPED_DATA_KEY_LENGTH_BYTES } from '../constants';
import { CorruptDataError, UnsupportedVersionError } from '../errors';
import { parseCryptoMetadata, type CryptoMetadata } from '../metadata';

/** Construye metadatos válidos para las pruebas. */
function makeMetadata(): CryptoMetadata {
  // Se usan arrays sintéticos con los tamaños del formato.
  return {
    v: 1,
    kdf: {
      alg: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: new Uint8Array(16),
    },
    wrappedDataKey: new Uint8Array(WRAPPED_DATA_KEY_LENGTH_BYTES),
    failedAttempts: 0,
    lockedUntil: null,
  };
}

describe('parseCryptoMetadata', () => {
  it('accepts valid metadata and returns a defensive copy', () => {
    // Se parte de metadatos válidos.
    const metadata = makeMetadata();

    // La lectura devuelve una copia válida.
    const parsed = parseCryptoMetadata(metadata);

    // Los arrays no deben compartir la misma referencia.
    expect(parsed.kdf.salt).not.toBe(metadata.kdf.salt);
    expect(parsed.wrappedDataKey).not.toBe(metadata.wrappedDataKey);

    // El contenido sí debe coincidir.
    expect(parsed).toEqual(metadata);
  });

  it('rejects unknown versions', () => {
    // Una versión futura necesita una migración explícita.
    expect(() => parseCryptoMetadata({ ...makeMetadata(), v: 2 })).toThrow(UnsupportedVersionError);
  });

  it('rejects malformed KDF parameters', () => {
    // La sal debe tener exactamente 16 bytes.
    expect(() =>
      parseCryptoMetadata({
        ...makeMetadata(),
        kdf: { ...makeMetadata().kdf, salt: new Uint8Array(8) },
      }),
    ).toThrow(CorruptDataError);

    // Solo se admite SHA-256.
    expect(() =>
      parseCryptoMetadata({
        ...makeMetadata(),
        kdf: { ...makeMetadata().kdf, hash: 'SHA-1' },
      }),
    ).toThrow(CorruptDataError);

    // No se aceptan menos iteraciones que el mínimo del formato.
    expect(() =>
      parseCryptoMetadata({
        ...makeMetadata(),
        kdf: { ...makeMetadata().kdf, iterations: PBKDF2_ITERATIONS - 1 },
      }),
    ).toThrow(CorruptDataError);
  });

  it('rejects invalid counters and wrapped keys', () => {
    // Un contador negativo no tiene sentido.
    expect(() => parseCryptoMetadata({ ...makeMetadata(), failedAttempts: -1 })).toThrow(
      CorruptDataError,
    );

    // Una DEK envuelta truncada no puede pasar la validación.
    expect(() =>
      parseCryptoMetadata({
        ...makeMetadata(),
        wrappedDataKey: new Uint8Array(WRAPPED_DATA_KEY_LENGTH_BYTES - 1),
      }),
    ).toThrow(CorruptDataError);

    // La espera debe ser `null` o un entero no negativo.
    expect(() => parseCryptoMetadata({ ...makeMetadata(), lockedUntil: -5 })).toThrow(
      CorruptDataError,
    );
  });

  it('rejects values that are not objects', () => {
    // La base de datos es un límite de confianza.
    expect(() => parseCryptoMetadata(null)).toThrow(CorruptDataError);
    expect(() => parseCryptoMetadata('metadata')).toThrow(CorruptDataError);
  });
});
