// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { PIN_MIN_LENGTH } from '../../crypto/constants';
import type { MessageKey } from '../../i18n';
import { useI18n } from '../../i18n/I18nProvider';
import type { VaultController } from '../../session/vaultController';
import { PinInput } from '../components/PinInput';
import { SessionToolbar } from '../components/SessionToolbar';
import { describePinError } from '../errors';

/** Propiedades de la pantalla de desbloqueo. */
interface PinUnlockScreenProps {
  /** Controlador de la bóveda. */
  readonly vault: VaultController;
  /** Acción síncrona de salida rápida. */
  readonly onQuickExit: () => void;
}

/** Mensaje de error ya traducido a una clave. */
interface PinMessage {
  readonly key: MessageKey;
  readonly seconds?: number;
}

/** Comprueba que el PIN solo contiene dígitos y alcanza la longitud mínima. */
function isValidPin(pin: string): boolean {
  // Se exige al menos `PIN_MIN_LENGTH` dígitos ASCII; no hay límite máximo en la interfaz.
  return /^\d+$/.test(pin) && pin.length >= PIN_MIN_LENGTH;
}

/**
 * Pantalla de desbloqueo.
 *
 * La espera por intentos fallidos se conoce solo después de un intento rechazado. La cuenta atrás se
 * muestra cada segundo, pero el lector de pantalla solo anuncia el inicio (región `alert`) y el final
 * (región `polite` con la etiqueta del botón), no cada segundo.
 */
export function PinUnlockScreen({ vault, onQuickExit }: PinUnlockScreenProps) {
  const { t } = useI18n();
  const pinRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PinMessage | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [waitFinished, setWaitFinished] = useState(false);

  // La cuenta atrás avanza un segundo cada vez; al llegar a cero se anuncia el final.
  useEffect(() => {
    if (waitSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setWaitSeconds((current) => {
        const next = Math.max(0, current - 1);

        if (next === 0) {
          setWaitFinished(true);
        }

        return next;
      });
    }, 1_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [waitSeconds]);

  /** Envía el PIN al llavero. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    // El PIN se lee una sola vez y no se copia a estado.
    const pin = pinRef.current?.value ?? '';

    try {
      // Una nueva operación descarta el anuncio de la espera anterior.
      setWaitFinished(false);

      // Validación local antes de gastar tiempo en PBKDF2.
      if (!isValidPin(pin)) {
        setError({ key: 'pin.error.format' });
        return;
      }

      setError(null);
      setBusy(true);

      // El llavero aplica la espera persistida y desenvuelve la DEK si el PIN es correcto.
      await vault.unlock(pin);
    } catch (caught) {
      const description = describePinError(caught);

      if (description.kind === 'message') {
        setError(description);

        // Una espera activa deshabilita el botón hasta que la cuenta atrás llegue a cero.
        if (description.seconds !== undefined && description.seconds > 0) {
          setWaitSeconds(description.seconds);
        } else {
          setWaitSeconds(0);
        }
      } else if (description.kind === 'refresh') {
        // Otra pestaña creó la bóveda: se refresca el estado sin mostrar detalles.
        await vault.start();
      }

      // `silent` significa que un bloqueo canceló la operación: no se muestra error.
    } finally {
      // El PIN se borra siempre, incluso si la validación local falló.
      if (pinRef.current !== null) {
        pinRef.current.value = '';
      }

      setBusy(false);
      pinRef.current?.focus();
    }
  };

  // Durante la espera, el mensaje visible cuenta los segundos; el lector recibe solo el inicio.
  const waitMessage =
    error !== null && error.key === 'pin.error.wait' && waitSeconds > 0
      ? t('pin.error.wait', { seconds: waitSeconds })
      : null;

  // El mensaje inicial de la espera se anuncia una sola vez.
  const waitAlert =
    error !== null && error.key === 'pin.error.wait' && waitSeconds > 0
      ? t('pin.error.wait', { seconds: error.seconds ?? waitSeconds })
      : null;

  // Los errores que no son espera se muestran una sola vez.
  const staticError =
    error !== null && error.key !== 'pin.error.wait'
      ? error.seconds === undefined
        ? t(error.key)
        : t(error.key, { seconds: error.seconds })
      : null;

  return (
    <div className="pin-screen">
      <SessionToolbar onQuickExit={onQuickExit} />
      <main id="main" className="screen screen-centered">
        <h1>{t('pin.unlock.title')}</h1>

        <form className="pin-form" onSubmit={handleSubmit} aria-busy={busy}>
          <PinInput id="pin" label={t('pin.label')} inputRef={pinRef} autoFocus />

          {staticError === null ? null : (
            <p className="error" role="alert">
              {staticError}
            </p>
          )}

          {waitMessage === null ? null : (
            <p className="error" aria-hidden="true">
              {waitMessage}
            </p>
          )}

          {waitAlert === null ? null : (
            <span className="sr-only" role="alert">
              {waitAlert}
            </span>
          )}

          <span className="sr-only" aria-live="polite">
            {waitFinished ? t('pin.unlock.submit') : ''}
          </span>

          <button
            type="submit"
            className="button button-primary"
            disabled={busy || waitSeconds > 0}
          >
            {busy ? t('pin.busy') : t('pin.unlock.submit')}
          </button>
        </form>
      </main>
    </div>
  );
}
