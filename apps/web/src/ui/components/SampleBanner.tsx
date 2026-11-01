// SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from '../../i18n/I18nProvider';

/**
 * Aviso permanente de contenido de demostración.
 *
 * El instrumento, el consentimiento y las remisiones de `content/` son muestras sin revisión
 * clínica. El aviso debe verse en todas las pantallas que usen ese contenido.
 */
export function SampleBanner() {
  const { t } = useI18n();

  return (
    <p className="sample-banner" role="note">
      {t('sample.banner')}
    </p>
  );
}
