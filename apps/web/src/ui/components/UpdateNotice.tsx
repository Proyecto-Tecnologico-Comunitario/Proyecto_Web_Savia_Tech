// SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from '../../i18n/I18nProvider';
import type { ServiceWorkerStatus } from '../../pwa/swStatus';

/** Propiedades del aviso de actualización. */
interface UpdateNoticeProps {
  /** Estado actual del service worker. */
  readonly state: ServiceWorkerStatus;
  /** En desbloqueo se ofrece el botón; en Ajustes solo se explica la regla. */
  readonly variant: 'unlock' | 'settings';
  /** Acción del botón «Actualizar». */
  readonly onApply?: () => void;
}

/** Aviso de que hay una versión nueva esperando. */
export function UpdateNotice({ state, variant, onApply }: UpdateNoticeProps) {
  const { t } = useI18n();

  // Sin actualización pendiente no hay nada que anunciar.
  if (state !== 'updateAvailable') {
    return null;
  }

  return (
    <section className="pwa-notice" role="status">
      <h2>{t('pwa.update.title')}</h2>
      {variant === 'settings' ? (
        <p>{t('pwa.update.onLock')}</p>
      ) : (
        <button type="button" className="button button-primary" onClick={onApply}>
          {t('pwa.update.apply')}
        </button>
      )}
    </section>
  );
}
