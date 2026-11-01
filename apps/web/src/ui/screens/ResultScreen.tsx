// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useRef } from 'react';

import type { Instrument } from '@saviatech/rules';

import { canSaveScreening, type ScreeningState } from '../../flows/screeningFlow';
import type { MessageKey } from '../../i18n';
import { useI18n } from '../../i18n/I18nProvider';

/**
 * Traducciones de las bandas de muestra.
 *
 * Las claves deben escribirse literales para que la prueba de i18n detecte su uso. Una banda
 * desconocida se muestra con su identificador en lugar de ocultarse.
 */
const BAND_KEYS: Readonly<Record<string, MessageKey>> = {
  minimal: 'band.minimal',
  mild: 'band.mild',
  moderate: 'band.moderate',
  'moderately-severe': 'band.moderatelySevere',
  severe: 'band.severe',
};

/** Propiedades de la pantalla de resultado. */
interface ResultScreenProps {
  /** Instrumento aplicado. */
  readonly instrument: Instrument;
  /** Estado con la evaluación y la decisión de la profesional. */
  readonly state: ScreeningState;
  /** El guardado está en curso. */
  readonly saving: boolean;
  /** El guardado falló y se puede reintentar. */
  readonly saveFailed: boolean;
  /** Cambia el nivel final. */
  readonly onFinalBand: (bandId: string) => void;
  /** Cambia la justificación. */
  readonly onJustification: (text: string) => void;
  /** Guarda el tamizaje. */
  readonly onSave: () => void;
}

/**
 * Resultado explicable del tamizaje.
 *
 * Muestra la puntuación, la banda calculada y las respuestas altas, y deja que la profesional
 * confirme o cambie el nivel. La herramienta nunca diagnostica: el nivel final es su decisión.
 */
export function ResultScreen({
  instrument,
  state,
  saving,
  saveFailed,
  onFinalBand,
  onJustification,
  onSave,
}: ResultScreenProps) {
  const { locale, t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // El foco va al título cuando aparece el resultado.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const evaluation = state.evaluation;
  const finalBand = state.finalBand;

  // Sin evaluación no hay nada que mostrar; no debería ocurrir con el reductor.
  if (evaluation === null || finalBand === null) {
    return null;
  }

  const language = instrument.languages[locale] ?? instrument.languages.es;
  const maxScore = Math.max(...instrument.optionValues) * language.items.length;
  const changed = finalBand !== evaluation.bandId;
  const justificationMissing = changed && state.justification.trim() === '';

  /** Traduce una banda o devuelve su identificador si es desconocida. */
  const bandLabel = (bandId: string): string => {
    const key = BAND_KEYS[bandId];
    return key === undefined ? bandId : t(key);
  };

  // Solo se listan las respuestas de valor 2 o más, con el texto del ítem.
  const relevantAnswers = state.answers.flatMap((answer, index) => {
    if (answer === null || answer < 2) {
      return [];
    }

    const itemText = language.items[index] ?? '';
    const optionPosition = instrument.optionValues.indexOf(answer);
    const optionText =
      optionPosition === -1 ? String(answer) : (language.options[optionPosition] ?? String(answer));

    return [{ index, itemText, optionText }];
  });

  return (
    <section className="result" aria-labelledby="result-title">
      <h2 id="result-title" ref={headingRef} tabIndex={-1}>
        {t('screening.resultTitle')}
      </h2>

      <p>{t('screening.score', { score: evaluation.score, max: maxScore })}</p>
      <p>{t('screening.band', { band: bandLabel(evaluation.bandId) })}</p>

      <h3>{t('screening.weightTitle')}</h3>
      {relevantAnswers.length === 0 ? (
        <p>{t('screening.weightNone')}</p>
      ) : (
        <ul className="result-answers">
          {relevantAnswers.map((entry) => (
            <li key={entry.index}>
              <span>{entry.itemText}</span> <span className="hint">({entry.optionText})</span>
            </li>
          ))}
        </ul>
      )}

      <p className="hint">{t('result.notDiagnosis')}</p>

      <div className="field">
        <label htmlFor="final-band">{t('screening.finalBand')}</label>
        <select
          id="final-band"
          value={finalBand}
          disabled={saving}
          onChange={(event) => {
            onFinalBand(event.currentTarget.value);
          }}
        >
          {instrument.bands.map((band) => (
            <option key={band.id} value={band.id}>
              {bandLabel(band.id)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="justification">{t('screening.justification')}</label>
        <textarea
          id="justification"
          rows={4}
          value={state.justification}
          disabled={saving}
          aria-describedby="justification-hint"
          onChange={(event) => {
            onJustification(event.currentTarget.value);
          }}
        />
        <p id="justification-hint" className="hint">
          {t('screening.justificationHint')}
        </p>
      </div>

      {justificationMissing ? (
        <p className="error" role="alert">
          {t('screening.justificationRequired')}
        </p>
      ) : null}

      {saveFailed ? (
        <p className="error" role="alert">
          {t('screening.saveError')}
        </p>
      ) : null}

      <div className="button-row">
        <button
          type="button"
          className="button button-primary"
          disabled={!canSaveScreening(state) || saving}
          onClick={onSave}
        >
          {saving ? t('screening.saving') : t('screening.save')}
        </button>
      </div>
    </section>
  );
}
