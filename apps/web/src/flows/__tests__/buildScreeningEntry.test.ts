// SPDX-License-Identifier: GPL-3.0-or-later

import type { Instrument } from '@saviatech/rules';
import { describe, expect, it } from 'vitest';

import { CONTENT_RESULT } from '../../content';
import { parseCasePayload, type ScreeningEntry } from '../../model/case';
import { buildScreeningEntry } from '../buildScreeningEntry';
import { initialScreeningState, reduceScreening, type ScreeningState } from '../screeningFlow';

/** Marca temporal de prueba, en UTC y con `Z`. */
const NOW = '2026-01-02T03:04:05.000Z';

/** Instrumento de muestra ya validado por el cargador de contenido. */
function sampleInstrument(): Instrument {
  if (!CONTENT_RESULT.ok) {
    throw new Error('sample content must be valid');
  }

  return CONTENT_RESULT.content.instrument;
}

/** Completa el tamizaje con una respuesta baja en todos los ítems. */
function finishedState(instrument: Instrument): ScreeningState {
  let state = initialScreeningState(instrument);
  const lastIndex = instrument.languages.es.items.length - 1;

  for (let index = 0; index <= lastIndex; index += 1) {
    state = reduceScreening(instrument, state, { type: 'answer', value: 0 });

    if (index < lastIndex) {
      state = reduceScreening(instrument, state, { type: 'next' });
    }
  }

  return reduceScreening(instrument, state, { type: 'finish' });
}

/** Falla si el estado no produjo un registro; evita repetir la comprobación de `null`. */
function expectEntry(entry: ScreeningEntry | null): ScreeningEntry {
  if (entry === null) {
    throw new Error('expected a screening entry');
  }

  return entry;
}

describe('buildScreeningEntry', () => {
  it('builds an entry with the engine score and no justification when the band is unchanged', () => {
    const instrument = sampleInstrument();
    const entry = expectEntry(buildScreeningEntry(instrument, finishedState(instrument), NOW));

    expect(entry.instrumentId).toBe('phq9-sample');
    expect(entry.instrumentVersion).toBe('0.1');
    expect(entry.answers).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(entry.score).toBe(0);
    expect(entry.computedBand).toBe('minimal');
    expect(entry.finalBand).toBe('minimal');
    expect(entry.justification).toBeNull();
    expect(entry.safetyAlert).toBe(false);
    expect(entry.timestamp).toBe(NOW);
  });

  it('trims the justification when the professional changes the band', () => {
    const instrument = sampleInstrument();
    const result = finishedState(instrument);
    const changed = reduceScreening(instrument, result, {
      type: 'setFinalBand',
      bandId: 'severe',
    });
    const justified = reduceScreening(instrument, changed, {
      type: 'setJustification',
      text: '  La profesional observó otros factores.  ',
    });
    const entry = expectEntry(buildScreeningEntry(instrument, justified, NOW));

    expect(entry.finalBand).toBe('severe');
    expect(entry.computedBand).toBe('minimal');
    expect(entry.justification).toBe('La profesional observó otros factores.');
  });

  it('refuses to build an entry when the changed band has no justification', () => {
    const instrument = sampleInstrument();
    const result = finishedState(instrument);
    const changed = reduceScreening(instrument, result, {
      type: 'setFinalBand',
      bandId: 'severe',
    });

    expect(buildScreeningEntry(instrument, changed, NOW)).toBeNull();
  });

  it('refuses to build an entry before finishing the questions', () => {
    const instrument = sampleInstrument();

    expect(buildScreeningEntry(instrument, initialScreeningState(instrument), NOW)).toBeNull();
  });

  it('produces an entry accepted by the case model', () => {
    const instrument = sampleInstrument();
    const entry = expectEntry(buildScreeningEntry(instrument, finishedState(instrument), NOW));

    const payload = parseCasePayload({
      code: 'ABCD-EFGH',
      synthetic: true,
      createdAt: NOW,
      consent: { textVersion: 'sample-1', timestamp: NOW },
      screenings: [entry],
    });

    expect(payload.screenings).toHaveLength(1);
    expect(payload.screenings[0]).toEqual(entry);
  });

  it('keeps the UTC timestamp exactly as provided', () => {
    const instrument = sampleInstrument();
    const entry = expectEntry(buildScreeningEntry(instrument, finishedState(instrument), NOW));

    expect(entry.timestamp.endsWith('Z')).toBe(true);
    expect(entry.timestamp).toBe(new Date(NOW).toISOString());
  });
});
