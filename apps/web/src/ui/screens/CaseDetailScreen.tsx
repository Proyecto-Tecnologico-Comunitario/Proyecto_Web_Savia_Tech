// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useMemo, useRef, useState } from 'react';

import { useApp } from '../../app/AppContext';
import { VaultLockedError } from '../../crypto/errors';
import { useI18n } from '../../i18n/I18nProvider';
import type { CaseRecord } from '../../model/case';
import { bandLabel } from '../bandLabels';
import { SampleBanner } from '../components/SampleBanner';

/** Estado de la carga del caso. */
type LoadStatus = 'loading' | 'ready' | 'error' | 'missing';

/** Propiedades del detalle del caso. */
interface CaseDetailScreenProps {
  /** Identificador aleatorio del caso. */
  readonly caseId: string;
  /** Vuelve a la lista de casos. */
  readonly onBack: () => void;
  /** Abre un tamizaje nuevo para este caso. */
  readonly onNewScreening: () => void;
  /** Abre la ruta de remisión sugerida. */
  readonly onReferral: () => void;
}

/**
 * Detalle de un caso.
 *
 * Muestra solo el código, la fecha de creación y el resumen de los tamizajes. Las respuestas y la
 * justificación no se repiten aquí: el contenido clínico se consulta en la pantalla de resultado.
 */
export function CaseDetailScreen({
  caseId,
  onBack,
  onNewScreening,
  onReferral,
}: CaseDetailScreenProps) {
  const app = useApp();
  const { locale, t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  // El foco va al título al abrir el detalle.
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

  // El formato de fecha se reutiliza mientras no cambie el idioma.
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Bogota',
      }),
    [locale],
  );

  if (status === 'loading') {
    return (
      <main id="main" className="screen">
        <h1>{t('caseDetail.title')}</h1>
        <p role="status">{t('caseDetail.loading')}</p>
      </main>
    );
  }

  if (status === 'missing') {
    return (
      <main id="main" className="screen">
        <h1>{t('caseDetail.title')}</h1>
        <p>{t('caseDetail.missing')}</p>
        <button type="button" className="button button-secondary" onClick={onBack}>
          {t('screening.back')}
        </button>
      </main>
    );
  }

  if (status === 'error' || record === null) {
    return (
      <main id="main" className="screen">
        <h1>{t('caseDetail.title')}</h1>
        <div role="alert">
          <p className="error">{t('caseDetail.loadError')}</p>
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

  return (
    <main id="main" className="screen">
      <SampleBanner />

      <h1 ref={headingRef} tabIndex={-1}>
        {t('caseDetail.title')}
      </h1>

      <p className="case-code">{record.code}</p>
      <p className="hint">
        {t('caseDetail.createdAt', { date: dateFormatter.format(new Date(record.createdAt)) })}
      </p>

      <h2>{t('caseDetail.screenings')}</h2>
      {record.screenings.length === 0 ? (
        <p>{t('caseDetail.noScreenings')}</p>
      ) : (
        <ul className="case-list">
          {record.screenings.map((screening, index) => (
            <li key={`${screening.timestamp}-${index}`} className="case-list-item">
              <p>{dateFormatter.format(new Date(screening.timestamp))}</p>
              <p className="hint">{bandLabel(screening.finalBand, t)}</p>
              {screening.safetyAlert ? <p className="warning">{t('caseDetail.alert')}</p> : null}
            </li>
          ))}
        </ul>
      )}

      <div className="button-row">
        <button type="button" className="button button-primary" onClick={onNewScreening}>
          {t('caseDetail.newScreening')}
        </button>
        <button type="button" className="button button-secondary" onClick={onReferral}>
          {t('caseDetail.referral')}
        </button>
      </div>

      <button type="button" className="button button-secondary" onClick={onBack}>
        {t('screening.back')}
      </button>
    </main>
  );
}
