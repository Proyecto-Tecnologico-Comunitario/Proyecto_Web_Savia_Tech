// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useRef } from 'react';

import { useI18n } from '../../i18n/I18nProvider';

/** Propiedades de la pantalla neutral. */
interface NeutralScreenProps {
  /** Vuelve a la compuerta; como la bóveda está bloqueada, mostrará el PIN. */
  readonly onOpen: () => void;
}

/**
 * Pantalla neutral «Notas».
 *
 * No muestra el nombre de la app, logos, idioma ni salida rápida. Solo el título, un texto vacío y un
 * botón que vuelve a la compuerta.
 */
export function NeutralScreen({ onOpen }: NeutralScreenProps) {
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Al entrar en la pantalla neutral, el foco va al título para anunciar el cambio.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main id="main" className="screen screen-centered neutral">
      <h1 ref={headingRef} tabIndex={-1}>
        {t('neutral.title')}
      </h1>
      <p>{t('neutral.empty')}</p>
      <button type="button" className="button button-primary" onClick={onOpen}>
        {t('neutral.open')}
      </button>
    </main>
  );
}
