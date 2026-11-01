// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useRef } from 'react';

import { useI18n } from '../../i18n/I18nProvider';
import type { PersistenceStatus } from '../../storage';
import { PersistenceWarning } from '../components/PersistenceWarning';
import { SampleBanner } from '../components/SampleBanner';
import { CaseListScreen } from './CaseListScreen';

/** Propiedades de la pantalla de inicio. */
interface HomeScreenProps {
  /** Estado de la persistencia solicitada tras desbloquear. */
  readonly persistence: PersistenceStatus | null;
  /** Abre el formulario de nuevo caso. */
  readonly onNewCase: () => void;
}

/** Pantalla de inicio con el aviso de muestra y la lista de casos. */
export function HomeScreen({ persistence, onNewCase }: HomeScreenProps) {
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
      <SampleBanner />
      <PersistenceWarning status={persistence} />
      <CaseListScreen onNewCase={onNewCase} />
    </main>
  );
}
