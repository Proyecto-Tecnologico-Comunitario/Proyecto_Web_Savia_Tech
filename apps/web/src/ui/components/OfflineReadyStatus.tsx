// SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from '../../i18n/I18nProvider';
import type { ServiceWorkerStatus } from '../../pwa/swStatus';

/** Propiedades del indicador de disponibilidad sin conexión. */
interface OfflineReadyStatusProps {
  /** Estado actual del service worker. */
  readonly state: ServiceWorkerStatus;
}

/** Indica si el cascarón de la aplicación ya se puede abrir sin conexión. */
export function OfflineReadyStatus({ state }: OfflineReadyStatusProps) {
  const { t } = useI18n();

  // Mientras registra o hay una actualización pendiente no se muestra este indicador.
  if (state === 'offlineReady') {
    return <p className="hint">{t('pwa.offlineReady')}</p>;
  }

  if (state === 'error' || state === 'unsupported') {
    return <p className="hint">{t('pwa.offlineUnavailable')}</p>;
  }

  return null;
}
