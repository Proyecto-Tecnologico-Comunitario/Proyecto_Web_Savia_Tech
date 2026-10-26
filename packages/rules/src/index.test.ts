// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';

import * as rules from './index';

/** Comprueba que el punto de entrada expone la API pública esperada por la app web. */
describe('public API', () => {
  it('exposes the rules functions', () => {
    expect(typeof rules.validateInstrument).toBe('function');
    expect(typeof rules.validateAnswers).toBe('function');
    expect(typeof rules.scoreAnswers).toBe('function');
    expect(typeof rules.bandForScore).toBe('function');
    expect(typeof rules.hasSafetyAlert).toBe('function');
    expect(typeof rules.evaluateScreening).toBe('function');
  });
});