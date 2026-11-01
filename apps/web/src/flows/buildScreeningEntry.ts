// SPDX-License-Identifier: GPL-3.0-or-later

import { validateAnswers, type Instrument } from '@saviatech/rules';

import type { ScreeningEntry } from '../model/case';
import type { ScreeningState } from './screeningFlow';

/**
 * Convierte el estado final del tamizaje en el registro que se cifrará.
 *
 * La puntuación y la banda calculada vienen del motor de reglas; aquí no se recalculan. Devuelve
 * `null` si el estado no está listo, en lugar de lanzar, para que la pantalla pueda ignorar un
 * evento tardío sin romperse.
 */
export function buildScreeningEntry(
  instrument: Instrument,
  state: ScreeningState,
  nowIso: string,
): ScreeningEntry | null {
  // Solo se construye desde el resultado o justo después de guardar.
  if (state.step !== 'result' && state.step !== 'saved') {
    return null;
  }

  const evaluation = state.evaluation;
  const finalBand = state.finalBand;

  if (evaluation === null || finalBand === null) {
    return null;
  }

  // Se normalizan las respuestas otra vez: el estado pudo llegar manipulado desde la interfaz.
  const validated = validateAnswers(instrument, state.answers);

  if (!validated.ok) {
    return null;
  }

  const changed = finalBand !== evaluation.bandId;
  const justification = state.justification.trim();

  // Un cambio de nivel sin justificación no se puede persistir; la misma regla aplica el modelo.
  if (changed && justification === '') {
    return null;
  }

  return {
    instrumentId: instrument.id,
    instrumentVersion: instrument.version,
    answers: [...validated.value],
    score: evaluation.score,
    computedBand: evaluation.bandId,
    finalBand,
    justification: changed ? justification : null,
    safetyAlert: evaluation.safetyAlert,
    timestamp: nowIso,
  };
}
