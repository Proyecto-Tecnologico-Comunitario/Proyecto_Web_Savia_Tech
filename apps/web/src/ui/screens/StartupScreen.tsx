// SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from '../../i18n/I18nProvider';

/** Pantalla de arranque mientras se lee el estado de la bóveda. */
export function StartupScreen() {
  const { t } = useI18n();

  return (
    <main id="main" className="screen screen-centered">
      <h1 aria-live="polite">{t('app.loading')}</h1>
    </main>
  );
}
