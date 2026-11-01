// SPDX-License-Identifier: GPL-3.0-or-later

import type { ValidationIssue, ValidationResult } from '@saviatech/rules';

/** Tipos de servicio que la interfaz sabe traducir. */
export const REFERRAL_SERVICE_TYPES = ['health', 'legal', 'psychosocial'] as const;

/** Tipo de servicio de remisión. */
export type ReferralServiceType = (typeof REFERRAL_SERVICE_TYPES)[number];

/** Texto corto en los dos idiomas obligatorios. */
export interface LocalizedText {
  readonly es: string;
  readonly en: string;
}

/** Lista de líneas en los dos idiomas obligatorios. */
export interface LocalizedLines {
  readonly es: readonly string[];
  readonly en: readonly string[];
}

/** Servicio local de la ruta de remisión. */
export interface ReferralService {
  readonly id: string;
  /** Si es prioritario, la interfaz lo muestra antes que el resto. */
  readonly priority: boolean;
  readonly type: ReferralServiceType;
  readonly name: LocalizedText;
  /** Contacto de muestra; en v1 nunca es un número real. */
  readonly contact: string;
  readonly hours: LocalizedText;
  /** Fecha de última verificación; en v1 es un marcador de posición. */
  readonly lastVerified: string;
}

/** Contenido de remisión y protocolo de seguridad validado. */
export interface ReferralContent {
  readonly version: string;
  readonly status: 'SAMPLE';
  /** Bandas del instrumento que activan la ruta prioritaria. */
  readonly priorityBands: readonly string[];
  readonly safetyProtocol: LocalizedLines;
  readonly services: readonly ReferralService[];
}

/** Comprueba que un valor desconocido es un objeto plano, no `null` ni un array. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Comprueba que un valor es uno de los tipos de servicio traducibles. */
function isReferralServiceType(value: unknown): value is ReferralServiceType {
  return typeof value === 'string' && (REFERRAL_SERVICE_TYPES as readonly string[]).includes(value);
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

/** Lee un texto bilingüe obligatorio. */
function readLocalizedText(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): LocalizedText | undefined {
  if (!isRecord(value)) {
    errors.push({ path, message: 'must be an object' });
    return undefined;
  }

  const es = readNonEmptyString(value, 'es', `${path}.es`, errors);
  const en = readNonEmptyString(value, 'en', `${path}.en`, errors);

  if (!es || !en) {
    return undefined;
  }

  return { es, en };
}

/** Lee una lista de líneas bilingüe con el mismo número de líneas en ambos idiomas. */
function readLocalizedLines(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): LocalizedLines | undefined {
  if (!isRecord(value)) {
    errors.push({ path, message: 'must be an object' });
    return undefined;
  }

  const es = readLines(value.es, `${path}.es`, errors);
  const en = readLines(value.en, `${path}.en`, errors);

  if (!es || !en) {
    return undefined;
  }

  if (es.length !== en.length) {
    errors.push({
      path: `${path}.en`,
      message: 'must have the same number of lines as Spanish',
    });
    return undefined;
  }

  return { es, en };
}

/** Lee una lista no vacía de líneas no vacías. */
function readLines(value: unknown, path: string, errors: ValidationIssue[]): string[] | undefined {
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

  return valid ? lines : undefined;
}

/** Lee y valida un servicio de la ruta. */
function readService(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): ReferralService | undefined {
  if (!isRecord(value)) {
    errors.push({ path, message: 'must be an object' });
    return undefined;
  }

  const id = readNonEmptyString(value, 'id', `${path}.id`, errors);
  const priority = value.priority;
  const type = value.type;
  const name = readLocalizedText(value.name, `${path}.name`, errors);
  const contact = readNonEmptyString(value, 'contact', `${path}.contact`, errors);
  const hours = readLocalizedText(value.hours, `${path}.hours`, errors);
  const lastVerified = readNonEmptyString(value, 'lastVerified', `${path}.lastVerified`, errors);

  if (typeof priority !== 'boolean') {
    errors.push({ path: `${path}.priority`, message: 'must be a boolean' });
  }

  if (!isReferralServiceType(type)) {
    errors.push({
      path: `${path}.type`,
      message: `must be one of: ${REFERRAL_SERVICE_TYPES.join(', ')}`,
    });
  }

  if (
    !id ||
    typeof priority !== 'boolean' ||
    !isReferralServiceType(type) ||
    !name ||
    !contact ||
    !hours ||
    !lastVerified
  ) {
    return undefined;
  }

  return { id, priority, type, name, contact, hours, lastVerified };
}

/**
 * Valida el archivo de remisión. `bandIds` son las bandas del instrumento ya validado; si es
 * `null` (instrumento inválido) se omite la comprobación de pertenencia para no duplicar errores.
 */
export function validateReferral(
  value: unknown,
  bandIds: readonly string[] | null,
): ValidationResult<ReferralContent> {
  const errors: ValidationIssue[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: [{ path: 'referral', message: 'must be an object' }] };
  }

  const version = readNonEmptyString(value, 'version', 'version', errors);
  const status = value.status;

  if (status !== 'SAMPLE') {
    errors.push({ path: 'status', message: "must be 'SAMPLE'" });
  }

  const priorityBands = readBands(value.priorityBands, bandIds, errors);
  const safetyProtocol = readLocalizedLines(value.safetyProtocol, 'safetyProtocol', errors);
  const services = readServices(value.services, errors);

  if (
    errors.length > 0 ||
    status !== 'SAMPLE' ||
    version === undefined ||
    !priorityBands ||
    !safetyProtocol ||
    !services
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      version,
      status,
      priorityBands,
      safetyProtocol,
      services,
    },
  };
}

/** Lee las bandas prioritarias y comprueba que existan en el instrumento. */
function readBands(
  value: unknown,
  bandIds: readonly string[] | null,
  errors: ValidationIssue[],
): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ path: 'priorityBands', message: 'must be a non-empty array of strings' });
    return undefined;
  }

  const bands: string[] = [];
  const seen = new Set<string>();
  let valid = true;

  value.forEach((entry, index) => {
    const path = `priorityBands[${index}]`;

    if (typeof entry !== 'string' || entry.trim() === '') {
      errors.push({ path, message: 'must be a non-empty string' });
      valid = false;
      return;
    }

    if (seen.has(entry)) {
      errors.push({ path, message: 'must be unique' });
      valid = false;
      return;
    }

    seen.add(entry);

    if (bandIds !== null && !bandIds.includes(entry)) {
      errors.push({ path, message: 'must be a band id declared by the instrument' });
      valid = false;
      return;
    }

    bands.push(entry);
  });

  return valid ? bands : undefined;
}

/** Lee la lista de servicios y comprueba que los ids no se repitan. */
function readServices(value: unknown, errors: ValidationIssue[]): ReferralService[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ path: 'services', message: 'must be a non-empty array of services' });
    return undefined;
  }

  const services: ReferralService[] = [];
  const seen = new Set<string>();
  let valid = true;

  value.forEach((entry, index) => {
    const path = `services[${index}]`;
    const service = readService(entry, path, errors);

    if (!service) {
      valid = false;
      return;
    }

    if (seen.has(service.id)) {
      errors.push({ path: `${path}.id`, message: 'must be unique' });
      valid = false;
      return;
    }

    seen.add(service.id);
    services.push(service);
  });

  return valid ? services : undefined;
}
