// SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from '../../i18n/I18nProvider';

/**
 * Botón que alterna entre español e inglés.
 *
 * El nombre accesible es siempre `header.language.switchTo`; el texto visible es el idioma al que se
 * cambiará, para que la acción sea comprensible sin abrir un menú.
 */
export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  // El siguiente idioma es el contrario del actual.
  const nextLocale = locale === 'es' ? 'en' : 'es';

  // Se muestra el nombre del idioma de destino en su propio idioma.
  const label = nextLocale === 'es' ? t('settings.language.es') : t('settings.language.en');

  return (
    <button
      type="button"
      className="button button-secondary"
      aria-label={t('header.language.switchTo')}
      onClick={() => setLocale(nextLocale)}
    >
      {label}
    </button>
  );
}
