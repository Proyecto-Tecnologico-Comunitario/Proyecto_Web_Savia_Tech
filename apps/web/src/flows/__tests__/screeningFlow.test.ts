// SPDX-License-Identifier: GPL-3.0-or-later

import type { Instrument } from '@saviatech/rules';
import { describe, expect, it } from 'vitest';

import { CONTENT_RESULT } from '../../content';
import {
  canSaveScreening,
  initialScreeningState,
  reduceScreening,
  type ScreeningState,
} from '../screeningFlow';

/** Instrumento de muestra ya validado por el cargador de contenido. */
function sampleInstrument(): Instrument {
  if (!CONTENT_RESULT.ok) {
    throw new Error('sample content must be valid');
  }

  return CONTENT_RESULT.content.instrument;
}

/** Responde todos los ítems y deja la pantalla en la última pregunta. */
function answerAll(instrument: Instrument, safetyAnswer: number, baseAnswer = 0): ScreeningState {
  let state = initialScreeningState(instrument);
  const lastIndex = instrument.languages.es.items.length - 1;

  for (let index = 0; index <= lastIndex; index += 1) {
    const value = index === instrument.safetyItem.index ? safetyAnswer : baseAnswer;
    state = reduceScreening(instrument, state, { type: 'answer', value });

    if (index < lastIndex) {
      state = reduceScreening(instrument, state, { type: 'next' });
    }
  }

  return state;
}

/** Completa el tamizaje con el valor indicado en el ítem de seguridad. */
function finishWith(instrument: Instrument, safetyAnswer: number, baseAnswer = 0): ScreeningState {
  return reduceScreening(instrument, answerAll(instrument, safetyAnswer, baseAnswer), {
    type: 'finish',
  });
}

describe('screening flow', () => {
  it('starts with one empty answer per item', () => {
    const instrument = sampleInstrument();
    const state = initialScreeningState(instrument);

    expect(state.step).toBe('questions');
    expect(state.index).toBe(0);
    expect(state.answers).toHaveLength(instrument.languages.es.items.length);
    expect(state.answers.every((answer) => answer === null)).toBe(true);
    expect(state.evaluation).toBeNull();
    expect(state.finalBand).toBeNull();
  });

  it('accepts only option values and records the answer at the visible index', () => {
    const instrument = sampleInstrument();
    const state = initialScreeningState(instrument);
    const invalid = reduceScreening(instrument, state, { type: 'answer', value: 4 });

    expect(invalid).toBe(state);

    const answered = reduceScreening(instrument, state, { type: 'answer', value: 2 });

    expect(answered.answers[0]).toBe(2);
    expect(answered).not.toBe(state);
  });

  it('moves forward and backward without leaving the question range', () => {
    const instrument = sampleInstrument();
    const state = initialScreeningState(instrument);

    expect(reduceScreening(instrument, state, { type: 'back' })).toBe(state);

    const second = reduceScreening(instrument, state, { type: 'next' });

    expect(second.index).toBe(1);

    const back = reduceScreening(instrument, second, { type: 'back' });

    expect(back.index).toBe(0);

    let last = state;

    for (let step = 0; step < 20; step += 1) {
      last = reduceScreening(instrument, last, { type: 'next' });
    }

    expect(last.index).toBe(instrument.languages.es.items.length - 1);
  });

  it('keeps answers when moving backward', () => {
    const instrument = sampleInstrument();
    const answered = reduceScreening(instrument, initialScreeningState(instrument), {
      type: 'answer',
      value: 3,
    });
    const second = reduceScreening(instrument, answered, { type: 'next' });
    const back = reduceScreening(instrument, second, { type: 'back' });

    expect(back.answers[0]).toBe(3);
  });

  it('does not finish with unanswered items', () => {
    const instrument = sampleInstrument();
    const state = initialScreeningState(instrument);

    expect(reduceScreening(instrument, state, { type: 'finish' })).toBe(state);
  });

  it('finishes with the calculated band and no alert at the threshold', () => {
    const instrument = sampleInstrument();
    const state = finishWith(instrument, 0);

    expect(state.step).toBe('result');
    expect(state.evaluation?.score).toBe(0);
    expect(state.evaluation?.bandId).toBe('minimal');
    expect(state.evaluation?.safetyAlert).toBe(false);
    expect(state.finalBand).toBe('minimal');
  });

  it('shows the safety alert only when the safety item is above the threshold', () => {
    const instrument = sampleInstrument();
    const state = finishWith(instrument, 1);

    expect(state.step).toBe('safety-alert');
    expect(state.evaluation?.safetyAlert).toBe(true);
  });

  it('computes score and band with the rules engine', () => {
    const instrument = sampleInstrument();
    const state = finishWith(instrument, 0, 1);

    expect(state.evaluation?.score).toBe(8);
    expect(state.evaluation?.bandId).toBe('mild');
    expect(state.finalBand).toBe('mild');
  });

  it('only leaves the safety alert with acknowledgeAlert', () => {
    const instrument = sampleInstrument();
    const alert = finishWith(instrument, 1);

    expect(reduceScreening(instrument, alert, { type: 'next' })).toBe(alert);
    expect(reduceScreening(instrument, alert, { type: 'back' })).toBe(alert);
    expect(reduceScreening(instrument, alert, { type: 'answer', value: 0 })).toBe(alert);
    expect(reduceScreening(instrument, alert, { type: 'setFinalBand', bandId: 'severe' })).toBe(
      alert,
    );

    const result = reduceScreening(instrument, alert, { type: 'acknowledgeAlert' });

    expect(result.step).toBe('result');
  });

  it('ignores acknowledgeAlert outside the safety alert', () => {
    const instrument = sampleInstrument();
    const state = initialScreeningState(instrument);

    expect(reduceScreening(instrument, state, { type: 'acknowledgeAlert' })).toBe(state);
  });

  it('accepts only band ids declared by the instrument', () => {
    const instrument = sampleInstrument();
    const result = finishWith(instrument, 0);
    const invalid = reduceScreening(instrument, result, {
      type: 'setFinalBand',
      bandId: 'unknown',
    });

    expect(invalid).toBe(result);

    const changed = reduceScreening(instrument, result, { type: 'setFinalBand', bandId: 'severe' });

    expect(changed.finalBand).toBe('severe');
  });

  it('does not change the band before the result', () => {
    const instrument = sampleInstrument();
    const state = initialScreeningState(instrument);

    expect(reduceScreening(instrument, state, { type: 'setFinalBand', bandId: 'severe' })).toBe(
      state,
    );
  });

  it('saves an unchanged band without a justification', () => {
    const instrument = sampleInstrument();
    const result = finishWith(instrument, 0);

    expect(canSaveScreening(result)).toBe(true);
    expect(reduceScreening(instrument, result, { type: 'save' }).step).toBe('saved');
  });

  it('requires a non-blank justification when the band changes', () => {
    const instrument = sampleInstrument();
    const result = finishWith(instrument, 0);
    const changed = reduceScreening(instrument, result, { type: 'setFinalBand', bandId: 'severe' });

    expect(canSaveScreening(changed)).toBe(false);
    expect(reduceScreening(instrument, changed, { type: 'save' })).toBe(changed);

    const blank = reduceScreening(instrument, changed, { type: 'setJustification', text: '   ' });

    expect(reduceScreening(instrument, blank, { type: 'save' })).toBe(blank);

    const justified = reduceScreening(instrument, blank, {
      type: 'setJustification',
      text: 'La profesional observó otros factores.',
    });

    expect(canSaveScreening(justified)).toBe(true);
    expect(reduceScreening(instrument, justified, { type: 'save' }).step).toBe('saved');
  });

  it('ignores the justification outside the result', () => {
    const instrument = sampleInstrument();
    const state = initialScreeningState(instrument);

    expect(reduceScreening(instrument, state, { type: 'setJustification', text: 'x' })).toBe(state);
  });
});
