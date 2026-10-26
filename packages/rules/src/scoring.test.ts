// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';

import {
  bandForScore,
  evaluateScreening,
  hasSafetyAlert,
  scoreAnswers,
  validateAnswers,
} from './scoring';
import { sampleInstrument } from './test-fixtures';

/**
 * Tests de puntuación, bandas y alerta de seguridad.
 *
 * Los límites 0, 4, 5, 9, 10, 14, 15, 19, 20 y 27 son los del instrumento de muestra: cada uno
 * comprueba que una puntuación cae en la banda correcta y que el cambio de banda ocurre en el
 * punto exacto.
 */

const boundaryCases = [
  { score: 0, bandId: 'minimal' },
  { score: 4, bandId: 'minimal' },
  { score: 5, bandId: 'mild' },
  { score: 9, bandId: 'mild' },
  { score: 10, bandId: 'moderate' },
  { score: 14, bandId: 'moderate' },
  { score: 15, bandId: 'moderately-severe' },
  { score: 19, bandId: 'moderately-severe' },
  { score: 20, bandId: 'severe' },
  { score: 27, bandId: 'severe' },
] as const;

const allZeroAnswers = [0, 0, 0, 0, 0, 0, 0, 0, 0] as const;

describe('bandForScore', () => {
  it.each(boundaryCases)('maps score $score to band $bandId', ({ score, bandId }) => {
    expect(bandForScore(sampleInstrument, score)?.id).toBe(bandId);
  });

  it('returns undefined outside the covered score range', () => {
    expect(bandForScore(sampleInstrument, -1)).toBeUndefined();
    expect(bandForScore(sampleInstrument, 28)).toBeUndefined();
  });
});

describe('scoreAnswers', () => {
  it('sums validated answers', () => {
    expect(scoreAnswers([0, 1, 2, 3, 0, 1, 2, 3, 0])).toBe(12);
  });
});

describe('validateAnswers', () => {
  it('accepts a complete set of allowed answers', () => {
    const result = validateAnswers(sampleInstrument, allZeroAnswers);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }
  });

  it('rejects a missing item', () => {
    const result = validateAnswers(sampleInstrument, [0, 0, 0]);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors[0]?.path).toBe('answers');
      expect(result.errors.map((issue) => issue.path)).toContain('answers[3]');
    }
  });

  it('rejects a null answer', () => {
    const answers = [0, 0, 0, 0, 0, 0, 0, 0, null];
    const result = validateAnswers(sampleInstrument, answers);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.map((issue) => issue.path)).toContain('answers[8]');
    }
  });

  it('rejects an undefined answer', () => {
    const answers = [0, 0, 0, 0, 0, 0, 0, 0, undefined];
    const result = validateAnswers(sampleInstrument, answers);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.map((issue) => issue.path)).toContain('answers[8]');
    }
  });

  it('rejects a value that is not an allowed option', () => {
    const answers = [0, 0, 4, 0, 0, 0, 0, 0, 0];
    const result = validateAnswers(sampleInstrument, answers);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.map((issue) => issue.path)).toContain('answers[2]');
    }
  });

  it('rejects a non-integer value', () => {
    const answers = [0, 1.5, 0, 0, 0, 0, 0, 0, 0];
    const result = validateAnswers(sampleInstrument, answers);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.map((issue) => issue.path)).toContain('answers[1]');
    }
  });

  it('rejects extra answers', () => {
    const answers = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = validateAnswers(sampleInstrument, answers);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors[0]?.path).toBe('answers');
    }
  });
});

describe('hasSafetyAlert', () => {
  it('does not alert when the safety answer equals the threshold', () => {
    expect(hasSafetyAlert(sampleInstrument, allZeroAnswers)).toBe(false);
  });

  it('alerts when the safety answer is above the threshold', () => {
    const answers = [0, 0, 0, 0, 0, 0, 0, 0, 1];
    expect(hasSafetyAlert(sampleInstrument, answers)).toBe(true);
  });
});

describe('evaluateScreening', () => {
  it('returns the score, band and safety flag', () => {
    const answers = [1, 1, 1, 1, 1, 0, 0, 0, 0];

    expect(evaluateScreening(sampleInstrument, answers)).toEqual({
      ok: true,
      value: { score: 5, bandId: 'mild', safetyAlert: false },
    });
  });

  it('includes the safety alert when the safety item is above the threshold', () => {
    const answers = [0, 0, 0, 0, 0, 0, 0, 0, 1];

    expect(evaluateScreening(sampleInstrument, answers)).toEqual({
      ok: true,
      value: { score: 1, bandId: 'minimal', safetyAlert: true },
    });
  });

  it('returns validation errors for incomplete answers', () => {
    expect(evaluateScreening(sampleInstrument, [0, 0, 0])).toEqual({
      ok: false,
      errors: expect.any(Array),
    });
  });
});
