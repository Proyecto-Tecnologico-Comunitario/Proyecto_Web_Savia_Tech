// SPDX-License-Identifier: GPL-3.0-or-later

import type { ValidationIssue, ValidationResult } from '@saviatech/rules';

/**
 * Texto de consentimiento por capas. Se carga desde `content/consent/` y se valida antes de
 * mostrarlo, porque un texto incompleto podría ocultar al profesional qué está aceptando.
 */
export interface ConsentLanguage {
  /** Resumen visible de entrada; debe tener exactamente tres líneas. */
  readonly summary: readonly string[];
  /** Texto ampliado que se despliega a petición. */
  readonly full: readonly string[];
  /** Etiqueta de la casilla obligatoria. */
  readonly checkbox: string;
}

/** Contenido de consentimiento validado, con los dos idiomas obligatorios. */
export interface ConsentText {
  readonly version: string;
  readonly status: 'SAMPLE';
  readonly languages: {
    readonly es: ConsentLanguage;
    readonly en: ConsentLanguage;
  };
}

/** Comprueba que un valor desconocido es un objeto plano, no `null` ni un array. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lee una cadena obligatoria y no vacía. */
function readNonEmptyString(
  source: Record<string, unknown>,
  key: string,
  path: string,
  errors: ValidationIssue[],
): string | undefined {
  const value = source[key];

  if (typeof value !== 'string' || value.trim() === '') {
    errors.push({ path, message: 'must be a non-empty string' });
    return undefined;
  }

  return value;
}

/**
 * Lee una lista de líneas no vacías. Si se espera un número exacto, lo comprueba para que el
 * resumen no crezca ni se acorte sin que el contenido se revise.
 */
function readLines(
  value: unknown,
  path: string,
  expectedLength: number | null,
  errors: ValidationIssue[],
): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ path, message: 'must be a non-empty array of strings' });
    return undefined;
  }

  const lines: string[] = [];
  let valid = true;

  value.forEach((entry, index) => {
    if (typeof entry !== 'string' || entry.trim() === '') {
      errors.push({ path: `${path}[${index}]`, message: 'must be a non-empty string' });
      valid = false;
      return;
    }

    lines.push(entry);
  });

  if (expectedLength !== null && value.length !== expectedLength) {
    errors.push({ path, message: `must contain exactly ${expectedLength} lines` });
  }

  return valid ? lines : undefined;
}

/** Valida un idioma del consentimiento. */
function readLanguage(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): ConsentLanguage | undefined {
  if (!isRecord(value)) {
    errors.push({ path, message: 'must be an object' });
    return undefined;
  }

  const summary = readLines(value.summary, `${path}.summary`, 3, errors);
  const full = readLines(value.full, `${path}.full`, null, errors);
  const checkbox = readNonEmptyString(value, 'checkbox', `${path}.checkbox`, errors);

  if (!summary || !full || !checkbox) {
    return undefined;
  }

  return { summary, full, checkbox };
}

/**
 * Valida el archivo de consentimiento y devuelve una copia tipada solo si cumple las reglas.
 * Acumula los errores con su ruta para que un revisor de contenido pueda corregir el JSON.
 */
export function validateConsent(value: unknown): ValidationResult<ConsentText> {
  const errors: ValidationIssue[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: [{ path: 'consent', message: 'must be an object' }] };
  }

  const version = readNonEmptyString(value, 'version', 'version', errors);
  const status = value.status;

  if (status !== 'SAMPLE') {
    errors.push({ path: 'status', message: "must be 'SAMPLE'" });
  }

  const languages = value.languages;

  if (!isRecord(languages)) {
    errors.push({ path: 'languages', message: 'must be an object' });
  }

  const es = isRecord(languages) ? readLanguage(languages.es, 'languages.es', errors) : undefined;
  const en = isRecord(languages) ? readLanguage(languages.en, 'languages.en', errors) : undefined;

  if (isRecord(languages) && languages.es === undefined) {
    errors.push({ path: 'languages.es', message: 'Spanish content is required' });
  }

  if (isRecord(languages) && languages.en === undefined) {
    errors.push({ path: 'languages.en', message: 'English content is required' });
  }

  // La paridad de líneas evita que una traducción quede más corta y oculte información.
  if (es && en) {
    if (es.summary.length !== en.summary.length) {
      errors.push({
        path: 'languages.en.summary',
        message: 'must have the same number of lines as Spanish',
      });
    }

    if (es.full.length !== en.full.length) {
      errors.push({
        path: 'languages.en.full',
        message: 'must have the same number of paragraphs as Spanish',
      });
    }
  }

  if (errors.length > 0 || status !== 'SAMPLE' || version === undefined || !es || !en) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      version,
      status,
      languages: { es, en },
    },
  };
}
