// SPDX-License-Identifier: MIT
import type {
  AnswerInput,
  Band,
  Instrument,
  ScreeningResult,
  ValidationIssue,
  ValidationResult,
} from './types';

/**
 * Cálculo de puntuaciones, bandas y alerta de seguridad.
 *
 * Todas las funciones son puras y reciben un `Instrument` ya validado. Aun así, las respuestas se
 * validan aquí porque llegan de la interacción con la persona usuaria y pueden estar incompletas o
 * manipuladas.
 */

/**
 * Valida las respuestas de un cribado.
 *
 * Reglas:
 * - debe haber exactamente una respuesta por ítem; un ítem sin responder es un error;
 * - `null` y `undefined` cuentan como no respondidos;
 * - cada valor debe ser un entero incluido en `optionValues`.
 *
 * Devuelve una copia normalizada para que las funciones siguientes no tengan que repetir estas
 * comprobaciones.
 */
export function validateAnswers(
  instrument: Instrument,
  answers: readonly AnswerInput[],
): ValidationResult<readonly number[]> {
  const itemCount = instrument.languages.es.items.length;
  const allowedValues = new Set(instrument.optionValues);
  const errors: ValidationIssue[] = [];

  if (answers.length !== itemCount) {
    errors.push({
      path: 'answers',
      message: `expected ${itemCount} answers, received ${answers.length}`,
    });
  }

  const normalized: number[] = [];

  for (let index = 0; index < itemCount; index += 1) {
    const answer = answers[index];

    if (typeof answer !== 'number' || !Number.isInteger(answer) || !allowedValues.has(answer)) {
      errors.push({ path: `answers[${index}]`, message: 'missing or invalid answer' });
      continue;
    }

    normalized.push(answer);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: normalized };
}

/** Suma las respuestas ya validadas. La puntuación es la suma directa de los valores. */
export function scoreAnswers(answers: readonly number[]): number {
  return answers.reduce((total, answer) => total + answer, 0);
}

/** Busca la banda que contiene una puntuación. Devuelve `undefined` si no hay cobertura. */
export function bandForScore(instrument: Instrument, score: number): Band | undefined {
  return instrument.bands.find((band) => score >= band.min && score <= band.max);
}

/**
 * Indica si debe mostrarse la alerta de seguridad. La comparación es estrictamente mayor que el
 * umbral: con `alertWhenAbove: 0`, una respuesta de 1 o más activa la alerta.
 */
export function hasSafetyAlert(instrument: Instrument, answers: readonly number[]): boolean {
  const answer = answers[instrument.safetyItem.index];

  if (answer === undefined) {
    return false;
  }

  return answer > instrument.safetyItem.alertWhenAbove;
}

/**
 * Ejecuta el cribado completo: valida respuestas, suma, busca la banda y calcula la alerta.
 *
 * No decide nada clínicamente: devuelve el resultado calculado para que la profesional lo revise y
 * lo confirme o lo cambie con una justificación.
 */
export function evaluateScreening(
  instrument: Instrument,
  answers: readonly AnswerInput[],
): ValidationResult<ScreeningResult> {
  const validated = validateAnswers(instrument, answers);

  if (!validated.ok) {
    return { ok: false, errors: validated.errors };
  }

  const score = scoreAnswers(validated.value);
  const band = bandForScore(instrument, score);

  if (band === undefined) {
    return {
      ok: false,
      errors: [{ path: 'score', message: `no band covers the score ${score}` }],
    };
  }

  return {
    ok: true,
    value: {
      score,
      bandId: band.id,
      safetyAlert: hasSafetyAlert(instrument, validated.value),
    },
  };
}
