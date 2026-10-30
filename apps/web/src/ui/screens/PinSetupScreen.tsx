// SPDX-License-Identifier: GPL-3.0-or-later

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { PIN_MIN_LENGTH } from '../../crypto/constants';
import type { MessageKey } from '../../i18n';
import { useI18n } from '../../i18n/I18nProvider';
import type { VaultController } from '../../session/vaultController';
import { PinInput } from '../components/PinInput';
import { SessionToolbar } from '../components/SessionToolbar';
import { describePinError } from '../errors';

/** Propiedades de la pantalla de creación del PIN. */
interface PinSetupScreenProps {
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
 * Pantalla de creación del PIN.
 *
 * El PIN se lee del DOM solo al enviar y se vacía siempre en `finally`. No se guarda en estado de
 * React, contexto ni atributos.
 */
export function PinSetupScreen({ vault, onQuickExit }: PinSetupScreenProps) {
  const { t } = useI18n();
  const pinRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PinMessage | null>(null);

  /** Envía el PIN y la confirmación al llavero. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    // El PIN se lee una sola vez y no se copia a estado.
    const pin = pinRef.current?.value ?? '';
    const confirmation = confirmRef.current?.value ?? '';

    try {
      // Validación local antes de gastar tiempo en PBKDF2.
      if (!isValidPin(pin)) {
        setError({ key: 'pin.error.format' });
        return;
      }

      if (pin !== confirmation) {
        setError({ key: 'pin.error.mismatch' });
        return;
      }

      setError(null);
      setBusy(true);

      // El llavero valida de nuevo el PIN y crea la bóveda.
      await vault.setup(pin);
    } catch (caught) {
      const description = describePinError(caught);

      if (description.kind === 'message') {
        setError(description);
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
      if (confirmRef.current !== null) {
        confirmRef.current.value = '';
      }

      setBusy(false);
      pinRef.current?.focus();
    }
  };

  return (
    <div className="pin-screen">
      <SessionToolbar onQuickExit={onQuickExit} />
      <main id="main" className="screen screen-centered">
        <h1>{t('pin.setup.title')}</h1>
        <p className="hint">{t('pin.setup.hint')}</p>
        <p className="warning">{t('pin.setup.warning')}</p>

        <form className="pin-form" onSubmit={handleSubmit} aria-busy={busy}>
          <PinInput id="pin" label={t('pin.label')} inputRef={pinRef} autoFocus />
          <PinInput id="pin-confirmation" label={t('pin.confirm.label')} inputRef={confirmRef} />

          {error === null ? null : (
            <p className="error" role="alert">
              {error.seconds === undefined
                ? t(error.key)
                : t(error.key, { seconds: error.seconds })}
            </p>
          )}

          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? t('pin.busy') : t('pin.setup.submit')}
          </button>
        </form>
      </main>
    </div>
  );
}
