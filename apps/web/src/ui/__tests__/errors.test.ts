// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import {
  IncorrectPinError,
  InvalidPinError,
  TooManyAttemptsError,
  VaultAlreadyInitializedError,
  VaultLockedError,
} from '../../crypto/errors';
import { describePinError } from '../errors';

describe('describePinError', () => {
  it('maps an invalid PIN to the format message', () => {
    // La política local y el llavero comparten el mismo mensaje.
    expect(describePinError(new InvalidPinError())).toEqual({
      kind: 'message',
      key: 'pin.error.format',
    });
  });

  it('maps a wrong PIN to a generic incorrect message', () => {
    // No se revela si el PIN existe o cuántos intentos quedan.
    expect(describePinError(new IncorrectPinError())).toEqual({
      kind: 'message',
      key: 'pin.error.incorrect',
    });
  });

  it('rounds the retry delay up to whole seconds', () => {
    // 1500 ms debe mostrarse como 2 s, no como 1 s ni 1,5 s.
    expect(describePinError(new TooManyAttemptsError(1_500))).toEqual({
      kind: 'message',
      key: 'pin.error.wait',
      seconds: 2,
    });
  });

  it('is silent when a lock cancelled the operation', () => {
    // La compuerta ya cambió a bloqueado; mostrar un error sería confuso.
    expect(describePinError(new VaultLockedError())).toEqual({ kind: 'silent' });
  });

  it('asks for a refresh when another tab created the vault', () => {
    // No se muestran detalles; la pantalla vuelve a cargar el estado.
    expect(describePinError(new VaultAlreadyInitializedError())).toEqual({ kind: 'refresh' });
  });

  it('falls back to a generic message for unknown failures', () => {
    // Nunca se usa `error.message` ni se filtra el detalle técnico.
    expect(describePinError(new Error('internal detail'))).toEqual({
      kind: 'message',
      key: 'pin.error.generic',
    });
  });
});
