// SPDX-License-Identifier: GPL-3.0-or-later

import { validateInstrument } from '@saviatech/rules';
import { describe, expect, it } from 'vitest';

import consentFile from '../../../../../content/consent/consent.sample.json';
import instrumentFile from '../../../../../content/instruments/phq9.sample.json';
import referralFile from '../../../../../content/referral/referral.sample.json';
import en from '../../i18n/en.json';
import es from '../../i18n/es.json';
import { CONTENT_RESULT, loadContentFrom, type AppContent, type ContentResult } from '..';
import { validateConsent } from '../consent';
import { validateReferral } from '../referral';

/** Falla con las rutas de error si el contenido no valida; facilita depurar un JSON roto. */
function expectOk(result: ContentResult): AppContent {
  if (!result.ok) {
    throw new Error(
      `unexpected content errors: ${result.errors.map((issue) => issue.path).join(', ')}`,
    );
  }

  return result.content;
}

/** Consentimiento mínimo válido para probar variantes inválidas. */
function consentFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 'sample-test',
    status: 'SAMPLE',
    languages: {
      es: {
        summary: ['uno', 'dos', 'tres'],
        full: ['párrafo uno', 'párrafo dos'],
        checkbox: 'Acepto',
      },
      en: {
        summary: ['one', 'two', 'three'],
        full: ['paragraph one', 'paragraph two'],
        checkbox: 'I agree',
      },
    },
    ...overrides,
  };
}

/** Servicio mínimo válido para probar variantes inválidas. */
function serviceFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'service-1',
    priority: true,
    type: 'health',
    name: { es: 'Servicio', en: 'Service' },
    contact: '000-000-0000',
    hours: { es: 'Siempre', en: 'Always' },
    lastVerified: 'SAMPLE',
    ...overrides,
  };
}

/** Remisión mínima válida para probar variantes inválidas. */
function referralFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 'sample-test',
    status: 'SAMPLE',
    priorityBands: ['moderate'],
    safetyProtocol: { es: ['paso uno'], en: ['step one'] },
    services: [serviceFixture()],
    ...overrides,
  };
}

describe('sample content', () => {
  it('loads and validates the three sample files', () => {
    const content = expectOk(CONTENT_RESULT);

    expect(content.instrument.id).toBe('phq9-sample');
    expect(content.instrument.version).toBe('0.1');
    expect(content.instrument.status).toBe('SAMPLE');
    expect(content.instrument.languages.es.items).toHaveLength(9);
    expect(content.instrument.languages.en.items).toHaveLength(9);
    expect(content.instrument.bands.map((band) => band.id)).toEqual([
      'minimal',
      'mild',
      'moderate',
      'moderately-severe',
      'severe',
    ]);

    expect(content.consent.version).toBe('sample-1');
    expect(content.consent.status).toBe('SAMPLE');
    expect(content.consent.languages.es.summary).toHaveLength(3);
    expect(content.consent.languages.en.summary).toHaveLength(3);
    expect(content.consent.languages.es.full).toHaveLength(
      content.consent.languages.en.full.length,
    );

    expect(content.referral.version).toBe('sample-1');
    expect(content.referral.status).toBe('SAMPLE');
    expect(content.referral.priorityBands).toEqual(['moderately-severe', 'severe']);
    expect(content.referral.services).toHaveLength(3);
    expect(content.referral.services.filter((service) => service.priority)).toHaveLength(1);

    // Toda banda prioritaria debe existir en el instrumento, como exige el contenido clínico.
    for (const bandId of content.referral.priorityBands) {
      expect(content.instrument.bands.map((band) => band.id)).toContain(bandId);
    }
  });

  it('has a translated label for every instrument band', () => {
    // El resultado y el detalle usan `band.<id>`; una banda sin texto mostraría su identificador.
    const content = expectOk(CONTENT_RESULT);

    for (const band of content.instrument.bands) {
      const key = `band.${band.id}`;

      expect(Object.keys(es), `missing es.${key}`).toContain(key);
      expect(Object.keys(en), `missing en.${key}`).toContain(key);
    }
  });

  it('validates the sample instrument with the rules package', () => {
    expect(validateInstrument(instrumentFile).ok).toBe(true);
  });

  it('reports instrument errors with their source and path prefix', () => {
    const result = loadContentFrom({ id: '' }, consentFile, referralFile);

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every((issue) => issue.source === 'instrument')).toBe(true);
    expect(result.errors.every((issue) => issue.path.startsWith('instrument.'))).toBe(true);
  });
});

describe('consent validation', () => {
  it('accepts a well-formed sample', () => {
    expect(validateConsent(consentFixture()).ok).toBe(true);
  });

  it('rejects a non-SAMPLE status, a wrong summary length and mismatched paragraphs', () => {
    const result = validateConsent(
      consentFixture({
        status: 'DRAFT',
        languages: {
          es: { summary: ['uno', 'dos'], full: ['párrafo uno', 'párrafo dos'], checkbox: 'Acepto' },
          en: { summary: ['one', 'two', 'three'], full: ['paragraph one'], checkbox: 'I agree' },
        },
      }),
    );

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    const paths = result.errors.map((issue) => issue.path);

    expect(paths).toContain('status');
    expect(paths).toContain('languages.es.summary');
    expect(paths).toContain('languages.en.full');
  });

  it('rejects an empty checkbox', () => {
    const result = validateConsent(
      consentFixture({
        languages: {
          es: { summary: ['uno', 'dos', 'tres'], full: ['párrafo'], checkbox: '' },
          en: { summary: ['one', 'two', 'three'], full: ['paragraph'], checkbox: 'I agree' },
        },
      }),
    );

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.errors.map((issue) => issue.path)).toContain('languages.es.checkbox');
  });

  it('requires Spanish and English', () => {
    const result = validateConsent(
      consentFixture({
        languages: {
          es: { summary: ['uno', 'dos', 'tres'], full: ['párrafo'], checkbox: 'Acepto' },
        },
      }),
    );

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.errors.map((issue) => issue.path)).toContain('languages.en');
  });
});

describe('referral validation', () => {
  it('accepts a well-formed sample whose priority bands exist', () => {
    expect(validateReferral(referralFixture(), ['moderate']).ok).toBe(true);
  });

  it('rejects a priority band that the instrument does not declare', () => {
    const result = validateReferral(referralFixture({ priorityBands: ['unknown'] }), ['moderate']);

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.errors.map((issue) => issue.path)).toContain('priorityBands[0]');
  });

  it('skips band membership when the instrument is invalid', () => {
    expect(validateReferral(referralFixture({ priorityBands: ['unknown'] }), null).ok).toBe(true);
  });

  it('rejects an unknown service type and mismatched protocol lines', () => {
    const result = validateReferral(
      referralFixture({
        safetyProtocol: { es: ['paso uno', 'paso dos'], en: ['step one'] },
        services: [serviceFixture({ type: 'unknown' })],
      }),
      ['moderate'],
    );

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    const paths = result.errors.map((issue) => issue.path);

    expect(paths).toContain('safetyProtocol.en');
    expect(paths).toContain('services[0].type');
  });

  it('rejects duplicate service ids', () => {
    const result = validateReferral(
      referralFixture({
        services: [serviceFixture({ id: 'same' }), serviceFixture({ id: 'same', type: 'legal' })],
      }),
      ['moderate'],
    );

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.errors.map((issue) => issue.path)).toContain('services[1].id');
  });
});
