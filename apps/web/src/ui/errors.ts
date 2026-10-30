// SPDX-License-Identifier: GPL-3.0-or-later

import {
  IncorrectPinError,
  InvalidPinError,
  TooManyAttemptsError,
  VaultAlreadyInitializedError,
  VaultLockedError,
} from '../crypto/errors';
import type { MessageKey } from '../i18n';

/** Resultado de traducir un error de PIN para la interfaz. */
export type PinErrorDescription =
  | { readonly kind: 'message'; readonly key: MessageKey; readonly seconds?: number }
  | { readonly kind: 'silent' }
  | { readonly kind: 'refresh' };

/**
 * Traduce un error del llavero a una acción de interfaz.
 *
 * Nunca se usa `error.message`: los mensajes de `crypto/` son para desarrollo y podrían filtrar
 * detalles. `VaultLockedError` es silencioso porque significa que un bloqueo canceló la operación.
 */
export function describePinError(error: unknown): PinErrorDescription {
  // Un bloqueo durante la operación no es un error para la persona: la compuerta ya cambió.
  if (error instanceof VaultLockedError) {
    return { kind: 'silent' };
  }

  // Otra pestaña creó la bóveda: se refresca el estado sin mostrar detalles.
  if (error instanceof VaultAlreadyInitializedError) {
    return { kind: 'refresh' };
  }

  // El PIN no cumple la política local o del llavero.
  if (error instanceof InvalidPinError) {
    return { kind: 'message', key: 'pin.error.format' };
  }

  // PIN válido pero incorrecto: mensaje genérico, sin pistas.
  if (error instanceof IncorrectPinError) {
    return { kind: 'message', key: 'pin.error.incorrect' };
  }

  // La espera se redondea hacia arriba para no mostrar 0 s antes de tiempo.
  if (error instanceof TooManyAttemptsError) {
    return {
      kind: 'message',
      key: 'pin.error.wait',
      seconds: Math.ceil(error.retryAfterMs / 1_000),
    };
  }

  // Cualquier otro fallo se muestra de forma genérica.
  return { kind: 'message', key: 'pin.error.generic' };
}
