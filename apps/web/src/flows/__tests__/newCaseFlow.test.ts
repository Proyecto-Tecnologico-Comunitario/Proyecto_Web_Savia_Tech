// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import {
  canAcceptConsent,
  initialNewCaseState,
  reduceNewCase,
  type NewCaseState,
} from '../newCaseFlow';

describe('new case flow', () => {
  it('starts pending with the consent checkbox unchecked', () => {
    const state = initialNewCaseState();

    expect(state.step).toBe('consent-pending');
    expect(state.consentChecked).toBe(false);
    expect(canAcceptConsent(state)).toBe(false);
  });

  it('does not accept consent without the checkbox', () => {
    const state = initialNewCaseState();
    const next = reduceNewCase(state, { type: 'acceptConsent' });

    // La transición inválida conserva la referencia para no crear un caso por accidente.
    expect(next).toBe(state);
    expect(next.step).toBe('consent-pending');
  });

  it('accepts consent once the checkbox is marked', () => {
    const checked = reduceNewCase(initialNewCaseState(), {
      type: 'setConsentChecked',
      checked: true,
    });

    expect(canAcceptConsent(checked)).toBe(true);

    const accepted = reduceNewCase(checked, { type: 'acceptConsent' });

    expect(accepted.step).toBe('consent-accepted');
    expect(accepted.consentChecked).toBe(true);
  });

  it('ignores checkbox changes after accepting', () => {
    const accepted: NewCaseState = { step: 'consent-accepted', consentChecked: true };
    const next = reduceNewCase(accepted, { type: 'setConsentChecked', checked: false });

    expect(next).toBe(accepted);
  });

  it('ignores a repeated acceptance', () => {
    const accepted: NewCaseState = { step: 'consent-accepted', consentChecked: true };

    expect(reduceNewCase(accepted, { type: 'acceptConsent' })).toBe(accepted);
  });

  it('returns to the initial state on reset', () => {
    const accepted: NewCaseState = { step: 'consent-accepted', consentChecked: true };

    expect(reduceNewCase(accepted, { type: 'reset' })).toEqual(initialNewCaseState());
  });
});
