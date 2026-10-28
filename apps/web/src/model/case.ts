// SPDX-License-Identifier: GPL-3.0-or-later

import { CorruptDataError } from '../crypto/errors';
import { getRandomBytes } from '../crypto/webcrypto';
import { InvalidCaseDataError } from '../storage/errors';

/**
 * Modelo del caso que se cifra antes de persistirse.
 *
 * Nada de este contenido aparece en claro en IndexedDB. El `id` del registro y su marca de
 * actualización viven fuera del cifrado en la fila de Dexie.
 */

/**
 * Marca temporal ISO 8601 en UTC, con `Z` obligatoria.
 *
 * Se guarda el instante absoluto, no la hora local. Para mostrar la hora de Colombia
 * (`America/Bogota`, UTC-5) la interfaz debe usar `Intl.DateTimeFormat` con
 * `timeZone: 'America/Bogota'`. Nunca se persiste una hora local con `Z`: eso representaría otro
 * instante y desplazaría los hechos clínicos cinco horas.
 */
export type UtcTimestamp = string;

/** Consentimiento aceptado por la profesional antes de crear el caso. */
export interface ConsentEntry {
  /** Versión del texto aceptado, por ejemplo `sample-1`. */
  textVersion: string;
  /** Instante UTC en que se aceptó. */
  timestamp: UtcTimestamp;
}

/** Resultado de un tamizaje, incluida la decisión final de la profesional. */
export interface ScreeningEntry {
  /** Identificador del instrumento de `content/`. */
  instrumentId: string;
  /** Versión del instrumento aplicada. */
  instrumentVersion: string;
  /** Respuestas en el orden de los ítems. */
  answers: number[];
  /** Puntuación calculada por `@saviatech/rules`; el almacenamiento no la recalcula. */
  score: number;
  /** Banda calculada por el motor de reglas. */
  computedBand: string;
  /** Banda confirmada o cambiada por la profesional. */
  finalBand: string;
  /** Justificación obligatoria cuando `finalBand` difiere de `computedBand`. */
  justification: string | null;
  /** Indica si se activó la alerta del ítem de seguridad. */
  safetyAlert: boolean;
  /** Instante UTC en que se completó el tamizaje. */
  timestamp: UtcTimestamp;
}

/** Contenido cifrado de un caso. */
export interface CasePayload {
  /** Código seudónimo legible, por ejemplo `K7QM-3XPA`. */
  code: string;
  /** `true` en todos los datos de demostración y pruebas. */
  synthetic: boolean;
  /** Instante UTC de creación; vive dentro del cifrado. */
  createdAt: UtcTimestamp;
  /** Consentimiento obligatorio: no se persiste un caso sin él. */
  consent: ConsentEntry;
  /** Tamizajes realizados dentro de este caso. */
  screenings: ScreeningEntry[];
}

/** Caso recuperado del repositorio, con los metadatos que quedan en claro. */
export interface CaseRecord extends CasePayload {
  /** Identificador aleatorio usado como índice y como AAD. */
  id: string;
  /** Valor de `actualizadoEn` de la fila, en milisegundos desde la época. */
  updatedAt: number;
}

/** Alfabeto sin caracteres ambiguos (`I`, `O`, `0`, `1`). */
const CASE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Número de símbolos del alfabeto; es una potencia de dos para evitar sesgo. */
const CASE_CODE_ALPHABET_SIZE = CASE_CODE_ALPHABET.length;

/** Bytes aleatorios necesarios para un código de ocho símbolos. */
const CASE_CODE_BYTES = 8;

/** Mitad visible del código antes del guion. */
const CASE_CODE_HALF_LENGTH = 4;

/** Formato del código seudónimo, coherente con el alfabeto. */
const CASE_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

/**
 * Patrón de marca temporal UTC.
 *
 * Se aceptan segundos y de cero a tres dígitos de fracción, pero siempre con `Z`. Los offsets como
 * `-05:00` se rechazan para que el instante no dependa del huso del dispositivo que creó el dato.
 */
const UTC_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

/** Campos exactos permitidos en cada nivel del modelo. */
const CASE_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  'code',
  'synthetic',
  'createdAt',
  'consent',
  'screenings',
]);
const CONSENT_KEYS: ReadonlySet<string> = new Set(['textVersion', 'timestamp']);
const SCREENING_KEYS: ReadonlySet<string> = new Set([
  'instrumentId',
  'instrumentVersion',
  'answers',
  'score',
  'computedBand',
  'finalBand',
  'justification',
  'safetyAlert',
  'timestamp',
]);

/** Comprueba que un valor desconocido es un objeto indexable. */
function isRecord(value: unknown): value is Record<string, unknown> {
  // Se exige un objeto que no sea `null` ni un array.
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Rechaza claves que no pertenecen al modelo. */
function assertKnownKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): void {
  // Un campo desconocido puede venir de un modelo distinto o de una migración incompleta.
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new CorruptDataError();
    }
  }
}

/** Lee un texto no vacío sin recortar el valor original. */
function readNonEmptyString(value: unknown): string {
  // Se rechazan tipos distintos de texto y cadenas que solo contienen espacios.
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CorruptDataError();
  }

  return value;
}

/** Lee un número finito; `NaN` e `Infinity` no son puntuaciones válidas. */
function readFiniteNumber(value: unknown): number {
  // `Number.isFinite` descarta cadenas numéricas, `NaN` e infinitos.
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CorruptDataError();
  }

  return value;
}

/** Comprueba que una cadena es una fecha ISO 8601 UTC real. */
function isUtcTimestamp(value: string): boolean {
  // La forma se valida antes de construir una fecha.
  const match = UTC_TIMESTAMP_PATTERN.exec(value);
  if (match === null) {
    return false;
  }

  // Se extraen los componentes para detectar fechas que JavaScript normalizaría en silencio.
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  // Los milisegundos se rellenan a la derecha: `.5` equivale a `.500`.
  const millisecond = Number((match[7] ?? '').padEnd(3, '0'));

  // `Date.UTC` normaliza valores fuera de rango (por ejemplo, el 30 de febrero).
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));

  // Si algún componente cambió, la fecha original no existía.
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

/** Lee y valida una marca temporal UTC. */
function readUtcTimestamp(value: unknown): UtcTimestamp {
  // Solo se aceptan textos con la forma exacta del formato.
  if (typeof value !== 'string' || !isUtcTimestamp(value)) {
    throw new CorruptDataError();
  }

  return value;
}

/** Valida y copia el consentimiento. */
function parseConsentEntry(value: unknown): ConsentEntry {
  // El consentimiento es un objeto obligatorio.
  if (!isRecord(value)) {
    throw new CorruptDataError();
  }

  // No se permiten campos fuera del modelo.
  assertKnownKeys(value, CONSENT_KEYS);

  // Se devuelve un objeto nuevo para no compartir referencias con la entrada.
  return {
    textVersion: readNonEmptyString(value.textVersion),
    timestamp: readUtcTimestamp(value.timestamp),
  };
}

/** Valida y copia un tamizaje, incluida la invariante de la justificación. */
function parseScreeningEntry(value: unknown): ScreeningEntry {
  // Cada tamizaje debe ser un objeto.
  if (!isRecord(value)) {
    throw new CorruptDataError();
  }

  // No se permiten campos fuera del modelo.
  assertKnownKeys(value, SCREENING_KEYS);

  // Las respuestas deben ser un array de números finitos; se copia para no compartir el original.
  if (!Array.isArray(value.answers)) {
    throw new CorruptDataError();
  }
  const answers = value.answers.map((answer) => readFiniteNumber(answer));

  // La justificación solo puede ser `null` o texto. El tipo se valida antes de la invariante.
  let justification: string | null;
  if (value.justification === null) {
    justification = null;
  } else if (typeof value.justification === 'string') {
    justification = value.justification;
  } else {
    throw new CorruptDataError();
  }

  // La alerta de seguridad es un booleano estricto, no una cadena que lo parezca.
  if (typeof value.safetyAlert !== 'boolean') {
    throw new CorruptDataError();
  }

  // Se leen los textos obligatorios del tamizaje.
  const instrumentId = readNonEmptyString(value.instrumentId);
  const instrumentVersion = readNonEmptyString(value.instrumentVersion);
  const computedBand = readNonEmptyString(value.computedBand);
  const finalBand = readNonEmptyString(value.finalBand);

  // Si la profesional cambió la banda calculada, debe explicar el cambio por escrito.
  if (finalBand !== computedBand && (justification === null || justification.trim().length === 0)) {
    throw new InvalidCaseDataError();
  }

  // Se devuelve un objeto nuevo con las respuestas copiadas.
  return {
    instrumentId,
    instrumentVersion,
    answers,
    score: readFiniteNumber(value.score),
    computedBand,
    finalBand,
    justification,
    safetyAlert: value.safetyAlert,
    timestamp: readUtcTimestamp(value.timestamp),
  };
}

/**
 * Valida el contenido descifrado de un caso.
 *
 * La base de datos es un límite de confianza y el JSON descifrado puede tener cualquier forma. Por
 * eso se comprueba cada campo antes de entregarlo a la interfaz o de volver a cifrarlo. Una forma o
 * un tipo incorrectos lanzan `CorruptDataError`; una invariante clínica incumplida lanza
 * `InvalidCaseDataError`.
 */
export function parseCasePayload(value: unknown): CasePayload {
  // La raíz debe ser un objeto.
  if (!isRecord(value)) {
    throw new CorruptDataError();
  }

  // No se aceptan campos fuera del modelo.
  assertKnownKeys(value, CASE_PAYLOAD_KEYS);

  // El código debe cumplir el formato seudónimo publicado.
  const code = readNonEmptyString(value.code);
  if (!CASE_CODE_PATTERN.test(code)) {
    throw new CorruptDataError();
  }

  // La marca sintética debe ser un booleano real.
  if (typeof value.synthetic !== 'boolean') {
    throw new CorruptDataError();
  }

  // Los tamizajes deben venir en un array; se valida cada elemento.
  if (!Array.isArray(value.screenings)) {
    throw new CorruptDataError();
  }

  // Se construye un objeto nuevo para que el llamador no pueda alterar la entrada original.
  return {
    code,
    synthetic: value.synthetic,
    createdAt: readUtcTimestamp(value.createdAt),
    consent: parseConsentEntry(value.consent),
    screenings: value.screenings.map((screening) => parseScreeningEntry(screening)),
  };
}

/**
 * Genera un código seudónimo de caso.
 *
 * Formato `XXXX-XXXX` con 32 símbolos. No hay comprobación de unicidad: hay 32^8 combinaciones y la
 * probabilidad de colisión es despreciable. El código no se usa como identificador de la fila, así
 * que una colisión no rompe el almacenamiento.
 */
export function generateCaseCode(): string {
  // Se usan ocho bytes de la fuente criptográfica del sistema.
  const bytes = getRandomBytes(CASE_CODE_BYTES);

  // 256 es múltiplo de 32, así que `byte % 32` es uniforme y no introduce sesgo.
  const characters = Array.from(bytes, (byte) =>
    CASE_CODE_ALPHABET.charAt(byte % CASE_CODE_ALPHABET_SIZE),
  );

  // Se separan los dos grupos legibles con un guion.
  return `${characters.slice(0, CASE_CODE_HALF_LENGTH).join('')}-${characters
    .slice(CASE_CODE_HALF_LENGTH)
    .join('')}`;
}
