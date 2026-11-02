// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useRef, useState } from 'react';

import { useApp } from '../../app/AppContext';
import { CONTENT_RESULT } from '../../content';
import type { ReferralServiceType } from '../../content/referral';
import { VaultLockedError } from '../../crypto/errors';
import type { MessageKey } from '../../i18n';
import { useI18n } from '../../i18n/I18nProvider';
import type { CaseRecord, ScreeningEntry } from '../../model/case';
import { SampleBanner } from '../components/SampleBanner';

/** Traducciones de los tipos de servicio. */
const TYPE_KEYS: Readonly<Record<ReferralServiceType, MessageKey>> = {
  health: 'referral.type.health',
  legal: 'referral.type.legal',
  psychosocial: 'referral.type.psychosocial',
};

/** Estado de la carga del caso. */
type LoadStatus = 'loading' | 'ready' | 'error' | 'missing';

/** Propiedades de la ruta de remisión. */
interface ReferralScreenProps {
  /** Identificador aleatorio del caso. */
  readonly caseId: string;
  /** Vuelve al detalle del caso. */
  readonly onBack: () => void;
}

/**
 * Ruta de remisión sugerida.
 *
 * Usa el último tamizaje: si la alerta de seguridad está activa o el nivel final pertenece a las
 * bandas prioritarias del contenido, los servicios prioritarios se muestran primero. Las remisiones
 * no se guardan; esta pantalla solo sugiere una ruta local de muestra.
 */
export function ReferralScreen({ caseId, onBack }: ReferralScreenProps) {
  const app = useApp();
  const { locale, t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  // El foco va al título al abrir la remisión.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // La carga se repite solo si se pide reintentar.
  useEffect(() => {
    let active = true;
    const epoch = app.vault.getSnapshot().epoch;
    setStatus('loading');

    void app.repository
      .get(caseId)
      .then((loaded) => {
        // Una respuesta tardía tras bloquear o reintentar no se aplica.
        if (!active || app.vault.getSnapshot().epoch !== epoch) {
          return;
        }

        if (loaded === null) {
          setStatus('missing');
          return;
        }

        setRecord(loaded);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active || app.vault.getSnapshot().epoch !== epoch) {
          return;
        }

        if (error instanceof VaultLockedError) {
          return;
        }

        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [app.repository, app.vault, caseId, reloadToken]);

  // Sin contenido válido no hay ruta que mostrar.
  if (!CONTENT_RESULT.ok) {
    return (
      <main id="main" className="screen">
        <h1>{t('referral.title')}</h1>
        <p className="error" role="alert">
          {t('cases.contentError')}
        </p>
        <button type="button" className="button button-secondary" onClick={onBack}>
          {t('screening.back')}
        </button>
      </main>
    );
  }

  if (status === 'loading') {
    return (
      <main id="main" className="screen">
        <h1>{t('referral.title')}</h1>
        <p role="status">{t('referral.loading')}</p>
      </main>
    );
  }

  if (status === 'missing') {
    return (
      <main id="main" className="screen">
        <h1>{t('referral.title')}</h1>
        <p>{t('referral.missing')}</p>
        <button type="button" className="button button-secondary" onClick={onBack}>
          {t('screening.back')}
        </button>
      </main>
    );
  }

  if (status === 'error' || record === null) {
    return (
      <main id="main" className="screen">
        <h1>{t('referral.title')}</h1>
        <div role="alert">
          <p className="error">{t('referral.loadError')}</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setReloadToken((token) => token + 1);
            }}
          >
            {t('cases.retry')}
          </button>
        </div>
      </main>
    );
  }

  const referral = CONTENT_RESULT.content.referral;
  const lastScreening: ScreeningEntry | undefined = record.screenings[record.screenings.length - 1];

  // D7: la alerta o el nivel final deciden si la ruta es prioritaria.
  const priority =
    lastScreening !== undefined &&
    (lastScreening.safetyAlert || referral.priorityBands.includes(lastScreening.finalBand));

  // Solo se reordena cuando la ruta es prioritaria; si no, se respeta el orden del contenido.
  const services = priority
    ? [...referral.services].sort((left, right) => Number(right.priority) - Number(left.priority))
    : referral.services;

  return (
    <main id="main" className="screen">
      <SampleBanner />

      <h1 ref={headingRef} tabIndex={-1}>
        {t('referral.title')}
      </h1>

      <p className="hint">{t('referral.version', { version: referral.version })}</p>

      {lastScreening === undefined ? <p>{t('referral.noScreenings')}</p> : null}
      {priority ? <p className="warning">{t('referral.priorityNotice')}</p> : null}

      <h2>{t('referral.servicesTitle')}</h2>
      <ul className="case-list">
        {services.map((service) => (
          <li key={service.id} className="case-list-item">
            <p className="case-code">{service.name[locale] ?? service.name.es}</p>
            <p className="hint">{t(TYPE_KEYS[service.type])}</p>
            <p>{service.hours[locale] ?? service.hours.es}</p>
            <p>{t('referral.contact', { contact: service.contact })}</p>
            <p className="hint">{t('referral.lastVerified', { date: service.lastVerified })}</p>
          </li>
        ))}
      </ul>

      <button type="button" className="button button-secondary" onClick={onBack}>
        {t('screening.back')}
      </button>
    </main>
  );
}
