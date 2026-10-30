// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useRef } from 'react';

import { useI18n } from '../../i18n/I18nProvider';
import type { PersistenceStatus } from '../../storage';
import { PersistenceWarning } from '../components/PersistenceWarning';

/** Propiedades de la pantalla de inicio provisional. */
interface HomeScreenProps {
  /** Estado de la persistencia solicitada tras desbloquear. */
  readonly persistence: PersistenceStatus | null;
}

/** Pantalla provisional de inicio; T6 añadirá la lista de casos. */
export function HomeScreen({ persistence }: HomeScreenProps) {
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Al montar la pantalla, el foco va al título para que el lector de pantalla anuncie el cambio.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main id="main" className="screen">
      <h1 ref={headingRef} tabIndex={-1}>
        {t('home.title')}
      </h1>
      <p>{t('home.placeholder')}</p>
      <PersistenceWarning status={persistence} />
    </main>
  );
}
