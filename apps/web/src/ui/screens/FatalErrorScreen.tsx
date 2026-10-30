// SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n';
import type { VaultFailure } from '../../session/vaultController';

/** Propiedades de la pantalla de error fatal. */
interface FatalErrorScreenProps {
  /** Causa clasificada por el controlador; `null` no debería ocurrir en `failed`. */
  readonly failure: VaultFailure | null;
  /** Vuelve a intentar la carga inicial. */
  readonly onRetry: () => void;
}

/** Clave de traducción para cada causa de fallo. */
const FAILURE_KEYS: Record<VaultFailure, MessageKey> = {
  'crypto-unavailable': 'app.fatal.cryptoUnavailable',
  storage: 'app.fatal.storage',
  corrupt: 'app.fatal.corrupt',
  'unsupported-version': 'app.fatal.unsupportedVersion',
};

/**
 * Pantalla de fallo fatal.
 *
 * Solo ofrece reintentar. No hay opción de borrar datos: un fallo de lectura no debe destruir la
 * única copia local.
 */
export function FatalErrorScreen({ failure, onRetry }: FatalErrorScreenProps) {
  const { t } = useI18n();

  // Si el controlador no clasificó el fallo, se usa el mensaje de almacenamiento.
  const key = failure === null ? 'app.fatal.storage' : FAILURE_KEYS[failure];

  return (
    <main id="main" className="screen screen-centered">
      <h1>{t('app.fatal.title')}</h1>
      <p role="alert">{t(key)}</p>
      <button type="button" className="button button-primary" onClick={onRetry}>
        {t('app.fatal.retry')}
      </button>
    </main>
  );
}
