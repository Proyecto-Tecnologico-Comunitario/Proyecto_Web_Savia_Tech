// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useReducer, useRef, useState } from 'react';

import { useApp } from '../../app/AppContext';
import { CONTENT_RESULT } from '../../content';
import { VaultLockedError } from '../../crypto/errors';
import { canAcceptConsent, initialNewCaseState, reduceNewCase } from '../../flows/newCaseFlow';
import { useI18n } from '../../i18n/I18nProvider';
import { SampleBanner } from '../components/SampleBanner';

/** Propiedades de la pantalla de nuevo caso. */
interface NewCaseScreenProps {
  /** Vuelve a la pantalla anterior. */
  readonly onBack: () => void;
  /** Recibe el identificador del caso recién creado. */
  readonly onCreated: (caseId: string) => void;
}

/**
 * Nuevo caso y consentimiento.
 *
 * El caso se crea solo al pulsar "Continuar" con la casilla marcada. Mientras la petición está en
 * curso no se puede enviar dos veces ni volver atrás. Si el bloqueo cambia de época, la respuesta
 * se descarta.
 */
export function NewCaseScreen({ onBack, onCreated }: NewCaseScreenProps) {
  const app = useApp();
  const { locale, t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(true);

  const [state, dispatch] = useReducer(reduceNewCase, initialNewCaseState());
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  // El foco va al título para que el lector de pantalla anuncie la pantalla nueva.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // La marca de montaje evita navegar después de desmontar por un bloqueo o una salida.
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // El consentimiento pendiente y el texto desplegado se descartan en cada bloqueo.
  useEffect(
    () =>
      app.volatileState.register(() => {
        dispatch({ type: 'reset' });
        setExpanded(false);
        setFailed(false);
        setSubmitting(false);
      }),
    [app.volatileState],
  );

  // Un contenido inválido no puede llegar a crear casos.
  if (!CONTENT_RESULT.ok) {
    return (
      <main id="main" className="screen">
        <h1 ref={headingRef} tabIndex={-1}>
          {t('newCase.title')}
        </h1>
        <SampleBanner />
        <p className="error" role="alert">
          {t('cases.contentError')}
        </p>
        <button type="button" className="button button-secondary" onClick={onBack}>
          {t('newCase.back')}
        </button>
      </main>
    );
  }

  const content = CONTENT_RESULT.content;
  const language = content.consent.languages[locale];

  /** Crea el caso con el consentimiento aceptado. */
  const handleContinue = (): void => {
    if (!canAcceptConsent(state) || submitting) {
      return;
    }

    // La época se captura antes de la petición para no aplicar una respuesta tardía.
    const epoch = app.vault.getSnapshot().epoch;
    setSubmitting(true);
    setFailed(false);

    void app.repository
      .create({
        consent: {
          textVersion: content.consent.version,
          timestamp: new Date().toISOString(),
        },
        synthetic: true,
      })
      .then((record) => {
        // Un bloqueo o un desmontaje descarta la navegación.
        if (!mountedRef.current || app.vault.getSnapshot().epoch !== epoch) {
          return;
        }

        dispatch({ type: 'acceptConsent' });
        onCreated(record.id);
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || app.vault.getSnapshot().epoch !== epoch) {
          return;
        }

        if (error instanceof VaultLockedError) {
          return;
        }

        setFailed(true);
        setSubmitting(false);
      });
  };

  return (
    <main id="main" className="screen">
      <h1 ref={headingRef} tabIndex={-1}>
        {t('newCase.title')}
      </h1>

      <SampleBanner />

      <button
        type="button"
        className="button button-secondary"
        disabled={submitting}
        onClick={onBack}
      >
        {t('newCase.back')}
      </button>

      <section aria-labelledby="consent-title">
        <h2 id="consent-title">{t('newCase.consentTitle')}</h2>

        <ul className="consent-summary">
          {language.summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <button
          type="button"
          className="button button-secondary"
          aria-expanded={expanded}
          aria-controls="consent-full"
          onClick={() => {
            setExpanded((current) => !current);
          }}
        >
          {expanded ? t('newCase.hideFull') : t('newCase.showFull')}
        </button>

        {expanded ? (
          <div id="consent-full" className="consent-full">
            {language.full.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        ) : null}
      </section>

      <div className="field">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={state.consentChecked}
            disabled={submitting}
            onChange={(event) => {
              dispatch({ type: 'setConsentChecked', checked: event.currentTarget.checked });
            }}
          />
          <span>{language.checkbox}</span>
        </label>
      </div>

      {failed ? (
        <p className="error" role="alert">
          {t('newCase.error')}
        </p>
      ) : null}

      <div className="button-row">
        <button
          type="button"
          className="button button-primary"
          disabled={!canAcceptConsent(state) || submitting}
          onClick={handleContinue}
        >
          {submitting ? t('newCase.creating') : t('newCase.continue')}
        </button>
      </div>
    </main>
  );
}
