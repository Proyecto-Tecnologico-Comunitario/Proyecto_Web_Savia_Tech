// SPDX-License-Identifier: GPL-3.0-or-later

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import type { Instrument } from '@saviatech/rules';

import { useApp } from '../../app/AppContext';
import { CONTENT_RESULT } from '../../content';
import type { ReferralContent } from '../../content/referral';
import { VaultLockedError } from '../../crypto/errors';
import { buildScreeningEntry } from '../../flows/buildScreeningEntry';
import {
  canSaveScreening,
  initialScreeningState,
  reduceScreening,
  type ScreeningAction,
  type ScreeningState,
} from '../../flows/screeningFlow';
import { useI18n } from '../../i18n/I18nProvider';
import type { CaseRecord } from '../../model/case';
import { SampleBanner } from '../components/SampleBanner';
import { ResultScreen } from './ResultScreen';
import { SafetyAlertScreen } from './SafetyAlertScreen';

/** Estado de la carga del caso. */
type LoadStatus = 'loading' | 'ready' | 'error' | 'missing';

/** Propiedades de la pantalla de tamizaje. */
interface ScreeningScreenProps {
  /** Identificador aleatorio del caso. */
  readonly caseId: string;
  /** Vuelve a la pantalla anterior sin guardar. */
  readonly onBack: () => void;
  /** Recibe el caso cuando el tamizaje ya se guardó. */
  readonly onSaved: (caseId: string) => void;
}

/**
 * Pantalla de tamizaje.
 *
 * Carga el caso antes de mostrar preguntas. Las respuestas viven solo en memoria y se registran en
 * `volatileState`. El guardado exige la decisión final de la profesional y se hace una sola vez.
 */
export function ScreeningScreen({ caseId, onBack, onSaved }: ScreeningScreenProps) {
  const app = useApp();
  const { t } = useI18n();

  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [reloadToken, setReloadToken] = useState(0);

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

  // Sin contenido válido no se pueden hacer tamizajes.
  if (!CONTENT_RESULT.ok) {
    return (
      <main id="main" className="screen">
        <h1>{t('screening.title')}</h1>
        <SampleBanner />
        <p className="error" role="alert">
          {t('cases.contentError')}
        </p>
        <button type="button" className="button button-secondary" onClick={onBack}>
          {t('screening.back')}
        </button>
      </main>
    );
  }

  const instrument = CONTENT_RESULT.content.instrument;
  const referral = CONTENT_RESULT.content.referral;

  if (status === 'loading') {
    return (
      <main id="main" className="screen">
        <h1>{t('screening.title')}</h1>
        <p role="status">{t('screening.loading')}</p>
      </main>
    );
  }

  if (status === 'error' || status === 'missing') {
    return (
      <main id="main" className="screen">
        <h1>{t('screening.title')}</h1>
        <p className="error" role="alert">
          {status === 'missing' ? t('screening.missing') : t('screening.loadError')}
        </p>
        <div className="button-row">
          {status === 'error' ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setReloadToken((token) => token + 1);
              }}
            >
              {t('cases.retry')}
            </button>
          ) : null}
          <button type="button" className="button button-secondary" onClick={onBack}>
            {t('screening.back')}
          </button>
        </div>
      </main>
    );
  }

  if (record === null) {
    return null;
  }

  return (
    <ScreeningSession
      record={record}
      instrument={instrument}
      referral={referral}
      onBack={onBack}
      onSaved={onSaved}
    />
  );
}

/** Propiedades de la sesión de tamizaje ya cargada. */
interface ScreeningSessionProps {
  readonly record: CaseRecord;
  readonly instrument: Instrument;
  readonly referral: ReferralContent;
  readonly onBack: () => void;
  readonly onSaved: (caseId: string) => void;
}

/** Sesión con el instrumento validado; aquí viven las respuestas. */
function ScreeningSession({
  record,
  instrument,
  referral,
  onBack,
  onSaved,
}: ScreeningSessionProps) {
  const app = useApp();
  const { locale, t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(true);

  const language = instrument.languages[locale] ?? instrument.languages.es;

  const [state, dispatch] = useReducer(
    (current: ScreeningState, action: ScreeningAction) =>
      reduceScreening(instrument, current, action),
    instrument,
    initialScreeningState,
  );

  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [finishError, setFinishError] = useState(false);

  // El foco va al título del instrumento al abrir el tamizaje.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // La marca de montaje evita navegar después de un bloqueo o una salida.
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Respuestas, nivel y justificación se descartan en cada bloqueo.
  useEffect(
    () =>
      app.volatileState.register(() => {
        dispatch({ type: 'reset' });
        setSaving(false);
        setSaveFailed(false);
        setFinishError(false);
      }),
    [app.volatileState],
  );

  const isLast = state.index >= language.items.length - 1;

  /** Finaliza las preguntas solo si no queda ninguna sin responder. */
  const finishQuestions = useCallback(() => {
    if (state.answers.some((answer) => answer === null)) {
      setFinishError(true);
      return;
    }

    setFinishError(false);
    dispatch({ type: 'finish' });
  }, [state.answers]);

  /** Guarda el tamizaje con la decisión final de la profesional. */
  const saveScreening = useCallback(() => {
    if (!canSaveScreening(state) || saving) {
      return;
    }

    const entry = buildScreeningEntry(instrument, state, new Date().toISOString());

    if (entry === null) {
      return;
    }

    // La época se captura antes de la petición para no aplicar una respuesta tardía.
    const epoch = app.vault.getSnapshot().epoch;
    setSaving(true);
    setSaveFailed(false);

    void app.repository
      .update(record.id, (current) => ({
        ...current,
        screenings: [...current.screenings, entry],
      }))
      .then((updated) => {
        if (!mountedRef.current || app.vault.getSnapshot().epoch !== epoch) {
          return;
        }

        dispatch({ type: 'save' });
        onSaved(updated.id);
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || app.vault.getSnapshot().epoch !== epoch) {
          return;
        }

        if (error instanceof VaultLockedError) {
          return;
        }

        setSaveFailed(true);
        setSaving(false);
      });
  }, [app.repository, app.vault, instrument, onSaved, record.id, saving, state]);

  return (
    <main id="main" className="screen">
      <header className="screening-header">
        <p className="case-code">{record.code}</p>
        <h1 ref={headingRef} tabIndex={-1}>
          {language.title}
        </h1>
        <p className="hint">{t('screening.meta', { version: instrument.version })}</p>
        <p className="sample-label">{t('sample.label')}</p>
      </header>

      <SampleBanner />

      {state.step === 'questions' ? (
        <section>
          <p className="hint" role="status">
            {t('screening.progress', {
              current: state.index + 1,
              total: language.items.length,
            })}
          </p>

          <fieldset className="settings-group">
            <legend>{language.items[state.index] ?? ''}</legend>
            {instrument.optionValues.map((value, position) => (
              <label className="radio-row" key={value}>
                <input
                  type="radio"
                  name={`screening-item-${state.index}`}
                  value={value}
                  checked={state.answers[state.index] === value}
                  onChange={() => {
                    setFinishError(false);
                    dispatch({ type: 'answer', value });
                  }}
                />
                <span>{language.options[position] ?? String(value)}</span>
              </label>
            ))}
          </fieldset>

          {finishError ? (
            <p className="error" role="alert">
              {t('screening.incomplete')}
            </p>
          ) : null}

          <div className="button-row">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                if (state.index === 0) {
                  onBack();
                  return;
                }

                dispatch({ type: 'back' });
              }}
            >
              {t('screening.back')}
            </button>

            {isLast ? (
              <button type="button" className="button button-primary" onClick={finishQuestions}>
                {t('screening.finish')}
              </button>
            ) : (
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  dispatch({ type: 'next' });
                }}
              >
                {t('screening.next')}
              </button>
            )}
          </div>
        </section>
      ) : null}

      {state.step === 'safety-alert' ? (
        <SafetyAlertScreen
          lines={referral.safetyProtocol[locale] ?? referral.safetyProtocol.es}
          onAcknowledge={() => {
            dispatch({ type: 'acknowledgeAlert' });
          }}
        />
      ) : null}

      {state.step === 'result' || state.step === 'saved' ? (
        <ResultScreen
          instrument={instrument}
          state={state}
          saving={saving}
          saveFailed={saveFailed}
          onFinalBand={(bandId) => {
            dispatch({ type: 'setFinalBand', bandId });
          }}
          onJustification={(text) => {
            dispatch({ type: 'setJustification', text });
          }}
          onSave={saveScreening}
        />
      ) : null}
    </main>
  );
}
