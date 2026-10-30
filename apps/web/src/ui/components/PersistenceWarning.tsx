// SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from '../../i18n/I18nProvider';
import type { PersistenceStatus } from '../../storage';

/** Propiedades del aviso de almacenamiento. */
interface PersistenceWarningProps {
  /** Resultado de la petición de persistencia; `null` mientras se resuelve. */
  readonly status: PersistenceStatus | null;
}

/**
 * Aviso discreto cuando el navegador no garantiza que los datos persistan.
 *
 * No bloquea la pantalla: la persona puede seguir trabajando, pero debe saber que el dispositivo
 * podría borrar los datos por falta de espacio.
 */
export function PersistenceWarning({ status }: PersistenceWarningProps) {
  const { t } = useI18n();

  // Solo se avisa si la persistencia fue denegada o no existe la API.
  if (status !== 'denied' && status !== 'unsupported') {
    return null;
  }

  return <p className="warning">{t('persist.warning')}</p>;
}
