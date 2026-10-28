// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { CorruptDataError } from '../../crypto/errors';
import { InvalidCaseDataError } from '../../storage/errors';
import {
  generateCaseCode,
  parseCasePayload,
  type CasePayload,
  type ConsentEntry,
  type ScreeningEntry,
} from '../case';

/**
 * Datos sintéticos de prueba.
 *
 * Las horas se escriben en UTC. Las que aparecen como 19:03Z corresponden a las 14:03 en Colombia
 * (`America/Bogota`, UTC-5); así se comprueba que la app guarda el instante y no la hora local.
 */
const VALID_CONSENT: ConsentEntry = {
  textVersion: 'sample-1',
  timestamp: '2026-10-28T19:02:00Z',
};

/** Tamizaje sintético válido; no procede de una persona real. */
const VALID_SCREENING: ScreeningEntry = {
  instrumentId: 'phq9-sample',
  instrumentVersion: '0.1',
  answers: [0, 1, 2, 1, 0, 1, 0, 0, 0],
  score: 5,
  computedBand: 'mild',
  finalBand: 'mild',
  justification: null,
  safetyAlert: false,
  timestamp: '2026-10-28T19:10:00Z',
};

/** Caso sintético completo y válido. */
const VALID_PAYLOAD: CasePayload = {
  code: 'K7QM-3XPA',
  synthetic: true,
  createdAt: '2026-10-28T19:03:00Z',
  consent: VALID_CONSENT,
  screenings: [VALID_SCREENING],
};

/** Clona el caso base para poder modificarlo sin compartir referencias. */
function clonePayload(): CasePayload {
  return structuredClone(VALID_PAYLOAD);
}

/** Clona un tamizaje base para poder modificarlo sin compartir referencias. */
function cloneScreening(): ScreeningEntry {
  return structuredClone(VALID_SCREENING);
}

/** Comprueba que una entrada con forma inválida lanza el error de datos corruptos. */
function expectCorrupt(value: unknown): void {
  expect(() => parseCasePayload(value)).toThrow(CorruptDataError);
}

/** Comprueba que una entrada válida en forma pero inválida en su invariante lanza el error de caso. */
function expectInvalidCase(value: unknown): void {
  expect(() => parseCasePayload(value)).toThrow(InvalidCaseDataError);
}

describe('parseCasePayload', () => {
  it('accepts a valid synthetic case and returns an independent copy', () => {
    // La entrada válida se acepta sin cambios de valor.
    const parsed = parseCasePayload(VALID_PAYLOAD);
    expect(parsed).toEqual(VALID_PAYLOAD);

    // El resultado no comparte referencias con el objeto original.
    expect(parsed).not.toBe(VALID_PAYLOAD);
    expect(parsed.consent).not.toBe(VALID_PAYLOAD.consent);

    const parsedScreening = parsed.screenings[0];
    const originalScreening = VALID_PAYLOAD.screenings[0];
    if (parsedScreening === undefined || originalScreening === undefined) {
      throw new Error('Expected one screening');
    }

    expect(parsedScreening).not.toBe(originalScreening);
    expect(parsedScreening.answers).not.toBe(originalScreening.answers);
  });

  it('accepts UTC timestamps with optional milliseconds and a literal Z', () => {
    // Los milisegundos son opcionales y siempre se exige UTC con `Z`.
    const withMilliseconds = {
      ...clonePayload(),
      createdAt: '2026-10-28T19:03:00.500Z',
    };

    expect(parseCasePayload(withMilliseconds).createdAt).toBe('2026-10-28T19:03:00.500Z');
  });

  it.each([null, [], 'text', 42, true])('rejects a non-object payload: %j', (value) => {
    // La raíz debe ser un objeto plano; el descifrado puede devolver cualquier JSON.
    expectCorrupt(value);
  });

  it('rejects a payload without required fields', () => {
    // Cada campo obligatorio se elimina uno a uno.
    for (const field of ['code', 'synthetic', 'createdAt', 'consent', 'screenings']) {
      const payload: Record<string, unknown> = { ...clonePayload() };
      delete payload[field];
      expectCorrupt(payload);
    }
  });

  it('rejects unknown fields at every level', () => {
    // Un campo inesperado indica un modelo distinto y no se persiste en silencio.
    expectCorrupt({ ...clonePayload(), extra: true });

    // El consentimiento no admite campos adicionales.
    const payloadWithExtraConsent = {
      ...clonePayload(),
      consent: { ...VALID_CONSENT, extra: true },
    };
    expectCorrupt(payloadWithExtraConsent);

    // El tamizaje tampoco admite campos adicionales.
    const payloadWithExtraScreening = {
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), extra: true }],
    };
    expectCorrupt(payloadWithExtraScreening);
  });

  it('rejects an invalid pseudonymous code', () => {
    // Se rechazan códigos sin guion, con minúsculas, con longitud distinta o con símbolos ambiguos.
    for (const code of [
      'K7QM3XPA',
      'k7qm-3xpa',
      'K7QM-3XP',
      'K7QM-3XPA1',
      'K7QM-3XPI',
      'K7QM-3XP0',
    ]) {
      expectCorrupt({ ...clonePayload(), code });
    }
  });

  it('rejects a non-boolean synthetic flag', () => {
    // La marca sintética debe ser un booleano real, no una cadena que lo parezca.
    expectCorrupt({ ...clonePayload(), synthetic: 'true' });
    expectCorrupt({ ...clonePayload(), synthetic: 1 });
  });

  it('rejects timestamps that are not ISO 8601 UTC with Z', () => {
    // No se aceptan horas locales, offsets ni formatos incompletos.
    for (const timestamp of [
      '2026-10-28T14:03:00-05:00',
      '2026-10-28T19:03:00',
      '2026-10-28 19:03:00Z',
      '28/10/2026 19:03:00Z',
      '2026-13-28T19:03:00Z',
      '2026-02-30T19:03:00Z',
      '2026-10-28T24:03:00Z',
      '2026-10-28T19:03:00.1234Z',
    ]) {
      expectCorrupt({ ...clonePayload(), createdAt: timestamp });
    }

    // La misma regla se aplica al consentimiento y a cada tamizaje.
    expectCorrupt({
      ...clonePayload(),
      consent: { ...VALID_CONSENT, timestamp: '2026-10-28T19:02:00-05:00' },
    });
    expectCorrupt({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), timestamp: '2026-10-28T19:10:00' }],
    });
  });

  it('requires a consent entry with a non-empty text version', () => {
    // El consentimiento es obligatorio y no puede venir vacío.
    expectCorrupt({ ...clonePayload(), consent: null });
    expectCorrupt({ ...clonePayload(), consent: { ...VALID_CONSENT, textVersion: '' } });
    expectCorrupt({ ...clonePayload(), consent: { ...VALID_CONSENT, textVersion: '   ' } });
  });

  it('requires screenings to be an array of valid entries', () => {
    // `screenings` debe ser un array; un objeto suelto no es válido.
    expectCorrupt({ ...clonePayload(), screenings: {} });
    expectCorrupt({ ...clonePayload(), screenings: [null] });
  });

  it('validates every screening field', () => {
    // Identificadores y bandas deben ser textos no vacíos.
    expectCorrupt({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), instrumentId: '' }],
    });
    expectCorrupt({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), instrumentVersion: '   ' }],
    });
    expectCorrupt({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), computedBand: '' }],
    });
    expectCorrupt({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), finalBand: 3 }],
    });

    // Respuestas y puntuación deben ser números finitos.
    expectCorrupt({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), answers: [0, '1', 2] }],
    });
    expectCorrupt({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), answers: [0, Number.NaN, 2] }],
    });
    expectCorrupt({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), answers: [0, Number.POSITIVE_INFINITY, 2] }],
    });
    expectCorrupt({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), answers: '0,1,2' }],
    });
    expectCorrupt({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), score: Number.NaN }],
    });

    // La alerta de seguridad debe ser booleana.
    expectCorrupt({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), safetyAlert: 'false' }],
    });

    // La justificación solo puede ser texto o `null`.
    expectCorrupt({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), justification: 5 }],
    });
  });

  it('requires a non-empty justification when the final band differs', () => {
    // Cambiar la banda calculada sin justificar el cambio rompe la invariante clínica.
    expectInvalidCase({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), finalBand: 'moderate', justification: null }],
    });
    expectInvalidCase({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), finalBand: 'moderate', justification: '' }],
    });
    expectInvalidCase({
      ...clonePayload(),
      screenings: [{ ...cloneScreening(), finalBand: 'moderate', justification: '   ' }],
    });

    // Una justificación con contenido sí se acepta y se conserva tal cual.
    const justified = {
      ...clonePayload(),
      screenings: [
        {
          ...cloneScreening(),
          finalBand: 'moderate',
          justification: '  La profesional valoró el contexto familiar.  ',
        },
      ],
    };
    expect(parseCasePayload(justified).screenings[0]?.justification).toBe(
      '  La profesional valoró el contexto familiar.  ',
    );
  });
});

describe('generateCaseCode', () => {
  /** Patrón del código seudónimo con el alfabeto sin caracteres ambiguos. */
  const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

  it('generates codes in XXXX-XXXX format from the defined alphabet', () => {
    // Se comprueba un lote pequeño para cubrir el formato y el alfabeto.
    for (let index = 0; index < 1_000; index += 1) {
      expect(generateCaseCode()).toMatch(CODE_PATTERN);
    }
  });

  it('does not repeat in ten thousand generated codes', () => {
    // 32^8 combinaciones hacen despreciable una colisión; esta prueba detecta fallos de aleatoriedad.
    const codes = new Set<string>();
    for (let index = 0; index < 10_000; index += 1) {
      codes.add(generateCaseCode());
    }

    expect(codes.size).toBe(10_000);
  });
});
