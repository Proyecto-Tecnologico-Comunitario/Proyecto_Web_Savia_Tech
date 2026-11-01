// SPDX-License-Identifier: GPL-3.0-or-later

import { validateInstrument, type Instrument, type ValidationIssue } from '@saviatech/rules';

import instrumentFile from '../../../../content/instruments/phq9.sample.json';
import consentFile from '../../../../content/consent/consent.sample.json';
import referralFile from '../../../../content/referral/referral.sample.json';
import { validateConsent, type ConsentText } from './consent';
import { validateReferral, type ReferralContent } from './referral';

/** Archivo de contenido del que proviene un error de validación. */
export type ContentSource = 'instrument' | 'consent' | 'referral';

/** Error de validación con el archivo de origen, para facilitar la corrección del contenido. */
export interface ContentIssue extends ValidationIssue {
  readonly source: ContentSource;
}

/** Contenido de la aplicación ya validado. */
export interface AppContent {
  readonly instrument: Instrument;
  readonly consent: ConsentText;
  readonly referral: ReferralContent;
}

/** Resultado explícito de la carga de contenido; nunca se lanza por datos inválidos. */
export type ContentResult =
  | { readonly ok: true; readonly content: AppContent }
  | { readonly ok: false; readonly errors: readonly ContentIssue[] };

/** Añade el archivo de origen y prefija la ruta de cada error. */
function withSource(source: ContentSource, issues: readonly ValidationIssue[]): ContentIssue[] {
  return issues.map((issue) => ({
    source,
    path: `${source}.${issue.path}`,
    message: issue.message,
  }));
}

/**
 * Valida los tres archivos de contenido. Se exporta con los valores como parámetros para poder
 * probar contenido inválido sin tocar los archivos reales.
 */
export function loadContentFrom(
  instrumentValue: unknown,
  consentValue: unknown,
  referralValue: unknown,
): ContentResult {
  const errors: ContentIssue[] = [];

  const instrument = validateInstrument(instrumentValue);

  if (!instrument.ok) {
    errors.push(...withSource('instrument', instrument.errors));
  }

  const consent = validateConsent(consentValue);

  if (!consent.ok) {
    errors.push(...withSource('consent', consent.errors));
  }

  // Si el instrumento no es válido no hay bandas contra las que comprobar la remisión; se omite
  // esa comprobación para no repetir un error que ya está explicado por el instrumento.
  const bandIds = instrument.ok ? instrument.value.bands.map((band) => band.id) : null;
  const referral = validateReferral(referralValue, bandIds);

  if (!referral.ok) {
    errors.push(...withSource('referral', referral.errors));
  }

  if (!instrument.ok || !consent.ok || !referral.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    content: {
      instrument: instrument.value,
      consent: consent.value,
      referral: referral.value,
    },
  };
}

/**
 * Contenido validado al importar el módulo. La app debe comprobar `ok` antes de permitir iniciar
 * un tamizaje; un archivo inválido nunca debe llegar a la pantalla de preguntas.
 */
export const CONTENT_RESULT: ContentResult = loadContentFrom(
  instrumentFile,
  consentFile,
  referralFile,
);
