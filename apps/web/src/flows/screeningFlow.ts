// SPDX-License-Identifier: GPL-3.0-or-later

import {
  evaluateScreening,
  validateAnswers,
  type Instrument,
  type ScreeningResult,
} from '@saviatech/rules';

/**
 * Estado puro del tamizaje: preguntas, alerta de seguridad, resultado y guardado.
 *
 * Las respuestas y la justificación viven solo en memoria. Este módulo no persiste nada ni conoce
 * React, para que cada transición se pueda probar y auditar por separado.
 */

/** Pasos internos del tamizaje. */
export type ScreeningStep = 'questions' | 'safety-alert' | 'result' | 'saved';

/** Estado del tamizaje en curso. */
export interface ScreeningState {
  readonly step: ScreeningStep;
  /** Pregunta visible, basada en cero. */
  readonly index: number;
  /** Respuesta por ítem; `null` significa sin responder. */
  readonly answers: readonly (number | null)[];
  /** Resultado del motor de reglas, disponible al completar las preguntas. */
  readonly evaluation: ScreeningResult | null;
  /** Nivel confirmado o cambiado por la profesional. */
  readonly finalBand: string | null;
  /** Justificación del cambio de nivel. */
  readonly justification: string;
}

/** Acciones que la pantalla puede despachar. */
export type ScreeningAction =
  | { readonly type: 'answer'; readonly value: number }
  | { readonly type: 'next' }
  | { readonly type: 'back' }
  | { readonly type: 'finish' }
  | { readonly type: 'acknowledgeAlert' }
  | { readonly type: 'setFinalBand'; readonly bandId: string }
  | { readonly type: 'setJustification'; readonly text: string }
  | { readonly type: 'save' };

/** Estado inicial con una casilla vacía por ítem. */
export function initialScreeningState(instrument: Instrument): ScreeningState {
  const itemCount = instrument.languages.es.items.length;

  return {
    step: 'questions',
    index: 0,
    answers: Array.from({ length: itemCount }, () => null),
    evaluation: null,
    finalBand: null,
    justification: '',
  };
}

/**
 * Indica si se puede guardar: hace falta un resultado, un nivel final y, si el nivel cambió, una
 * justificación que no sea solo espacios. La misma invariante la exige `parseCasePayload`.
 */
export function canSaveScreening(state: ScreeningState): boolean {
  if (state.step !== 'result' || state.evaluation === null || state.finalBand === null) {
    return false;
  }

  if (state.finalBand === state.evaluation.bandId) {
    return true;
  }

  return state.justification.trim() !== '';
}

/**
 * Reduce una acción al siguiente estado. Cualquier transición inválida devuelve el mismo objeto,
 * nunca lanza, para que un evento tardío no rompa la pantalla.
 */
export function reduceScreening(
  instrument: Instrument,
  state: ScreeningState,
  action: ScreeningAction,
): ScreeningState {
  switch (action.type) {
    case 'answer': {
      // Solo se responde en la fase de preguntas y con un valor declarado por el instrumento.
      if (state.step !== 'questions' || !instrument.optionValues.includes(action.value)) {
        return state;
      }

      const answers = [...state.answers];
      answers[state.index] = action.value;

      return { ...state, answers };
    }

    case 'next': {
      // Avanzar no valida: se permite dejar huecos y la comprobación ocurre al finalizar.
      if (state.step !== 'questions' || state.index >= state.answers.length - 1) {
        return state;
      }

      return { ...state, index: state.index + 1 };
    }

    case 'back': {
      // El retroceso nunca baja de la primera pregunta y conserva lo ya respondido.
      if (state.step !== 'questions' || state.index <= 0) {
        return state;
      }

      return { ...state, index: state.index - 1 };
    }

    case 'finish': {
      // Finalizar exige todas las respuestas; `evaluateScreening` también las revalida.
      if (state.step !== 'questions') {
        return state;
      }

      const validated = validateAnswers(instrument, state.answers);

      if (!validated.ok) {
        return state;
      }

      const evaluation = evaluateScreening(instrument, validated.value);

      if (!evaluation.ok) {
        return state;
      }

      return {
        ...state,
        step: evaluation.value.safetyAlert ? 'safety-alert' : 'result',
        evaluation: evaluation.value,
        finalBand: evaluation.value.bandId,
        justification: '',
      };
    }

    case 'acknowledgeAlert': {
      // Es la única salida de la alerta: no se puede volver a las preguntas desde ahí.
      if (state.step !== 'safety-alert') {
        return state;
      }

      return { ...state, step: 'result' };
    }

    case 'setFinalBand': {
      // Solo se elige un nivel declarado por el instrumento y después de ver el resultado.
      if (state.step !== 'result' || !instrument.bands.some((band) => band.id === action.bandId)) {
        return state;
      }

      if (state.finalBand === action.bandId) {
        return state;
      }

      return { ...state, finalBand: action.bandId };
    }

    case 'setJustification': {
      if (state.step !== 'result' || state.justification === action.text) {
        return state;
      }

      return { ...state, justification: action.text };
    }

    case 'save': {
      // El guardado real es asíncrono y ocurre fuera; aquí solo se marca como guardado si cumple
      // la invariante clínica.
      if (!canSaveScreening(state)) {
        return state;
      }

      return { ...state, step: 'saved' };
    }

    default: {
      return state;
    }
  }
}
