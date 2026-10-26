// SPDX-License-Identifier: MIT
import type {
  Band,
  Instrument,
  InstrumentLanguage,
  InstrumentLanguages,
  SafetyItem,
  ValidationIssue,
  ValidationResult,
} from './types';

/**
 * Validación del archivo de instrumento.
 *
 * Se implementa a mano, sin librerías de esquemas, para mantener el paquete sin dependencias y
 * revisar cada regla clínica de forma explícita. La validación comprueba:
 *
 * - forma y campos de texto obligatorios;
 * - estado `SAMPLE` (v1 no admite contenido clínico no revisado);
 * - presencia de español e inglés, con el mismo número de ítems;
 * - que haya una etiqueta de opción por cada valor de respuesta;
 * - valores de opción enteros y estrictamente crecientes;
 * - bandas ordenadas, sin huecos ni solapes, que cubren toda la puntuación posible;
 * - un ítem de seguridad dentro del rango y con un umbral alcanzable.
 *
 * No lanza excepciones por datos inválidos: devuelve `{ ok: false, errors }` para que la UI pueda
 * mostrar el problema y para que los tests no dependan de mensajes de excepción.
 */

/** Comprueba que un valor desconocido es un objeto plano, no `null` ni un array. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lee una cadena obligatoria y no vacía; si falla, registra el error y devuelve `undefined`. */
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

/** Lee un entero obligatorio. Rechaza decimales, cadenas, `NaN` e infinitos. */
function readInteger(
  source: Record<string, unknown>,
  key: string,
  path: string,
  errors: ValidationIssue[],
): number | undefined {
  const value = source[key];

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    errors.push({ path, message: 'must be an integer' });
    return undefined;
  }

  return value;
}

/** Lee un array no vacío de cadenas no vacías (ítems u opciones de un idioma). */
function readStringArray(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ path, message: 'must be a non-empty array of strings' });
    return undefined;
  }

  const result: string[] = [];
  let valid = true;

  value.forEach((entry, index) => {
    if (typeof entry !== 'string' || entry.trim() === '') {
      errors.push({ path: `${path}[${index}]`, message: 'must be a non-empty string' });
      valid = false;
      return;
    }

    result.push(entry);
  });

  return valid ? result : undefined;
}

/**
 * Valida el mapa de idiomas y exige español e inglés. Devuelve `undefined` si falta alguno o si
 * algún idioma tiene una forma inválida, para no construir un instrumento incompleto.
 */
function readLanguages(value: unknown, errors: ValidationIssue[]): InstrumentLanguages | undefined {
  if (!isRecord(value)) {
    errors.push({ path: 'languages', message: 'must be an object' });
    return undefined;
  }

  const languages: Record<string, InstrumentLanguage> = {};
  let valid = true;

  for (const code of Object.keys(value)) {
    const language = value[code];
    const path = `languages.${code}`;

    if (!isRecord(language)) {
      errors.push({ path, message: 'must be an object' });
      valid = false;
      continue;
    }

    const title = readNonEmptyString(language, 'title', `${path}.title`, errors);
    const items = readStringArray(language.items, `${path}.items`, errors);
    const options = readStringArray(language.options, `${path}.options`, errors);

    if (!title || !items || !options) {
      valid = false;
      continue;
    }

    languages[code] = { title, items, options };
  }

  const es = languages['es'];
  const en = languages['en'];

  if (!es) {
    errors.push({ path: 'languages.es', message: 'Spanish content is required' });
    valid = false;
  }

  if (!en) {
    errors.push({ path: 'languages.en', message: 'English content is required' });
    valid = false;
  }

  if (!valid || !es || !en) {
    return undefined;
  }

  return { ...languages, es, en };
}

/**
 * Valida los valores de respuesta: enteros, no vacíos y estrictamente crecientes. El orden
 * creciente permite que la puntuación máxima sea el último valor y detecta errores de contenido.
 */
function readOptionValues(value: unknown, errors: ValidationIssue[]): number[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ path: 'optionValues', message: 'must be a non-empty array of integers' });
    return undefined;
  }

  const numbers: number[] = [];
  let valid = true;

  value.forEach((entry, index) => {
    if (typeof entry !== 'number' || !Number.isInteger(entry)) {
      errors.push({ path: `optionValues[${index}]`, message: 'must be an integer' });
      valid = false;
      return;
    }

    numbers.push(entry);
  });

  if (!valid) {
    return undefined;
  }

  for (let index = 1; index < numbers.length; index += 1) {
    const previous = numbers[index - 1];
    const current = numbers[index];

    if (previous === undefined || current === undefined) {
      continue;
    }

    if (current <= previous) {
      errors.push({
        path: `optionValues[${index}]`,
        message: 'must be strictly greater than the previous value',
      });
      valid = false;
    }
  }

  return valid ? numbers : undefined;
}

/** Lee las bandas con su id y rango entero. La cobertura se comprueba después, en conjunto. */
function readBands(value: unknown, errors: ValidationIssue[]): Band[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ path: 'bands', message: 'must be a non-empty array of bands' });
    return undefined;
  }

  const bands: Band[] = [];
  let valid = true;

  value.forEach((entry, index) => {
    const path = `bands[${index}]`;

    if (!isRecord(entry)) {
      errors.push({ path, message: 'must be an object' });
      valid = false;
      return;
    }

    const id = readNonEmptyString(entry, 'id', `${path}.id`, errors);
    const min = readInteger(entry, 'min', `${path}.min`, errors);
    const max = readInteger(entry, 'max', `${path}.max`, errors);

    if (id === undefined || min === undefined || max === undefined) {
      valid = false;
      return;
    }

    bands.push({ id, min, max });
  });

  return valid ? bands : undefined;
}

/** Lee el ítem de seguridad y rechaza índices negativos. El umbral se valida con las opciones. */
function readSafetyItem(value: unknown, errors: ValidationIssue[]): SafetyItem | undefined {
  if (!isRecord(value)) {
    errors.push({ path: 'safetyItem', message: 'must be an object' });
    return undefined;
  }

  const index = readInteger(value, 'index', 'safetyItem.index', errors);
  const alertWhenAbove = readInteger(value, 'alertWhenAbove', 'safetyItem.alertWhenAbove', errors);

  if (index === undefined || alertWhenAbove === undefined) {
    return undefined;
  }

  if (index < 0) {
    errors.push({ path: 'safetyItem.index', message: 'must be zero or greater' });
    return undefined;
  }

  return { index, alertWhenAbove };
}

/**
 * Comprueba la coherencia entre idiomas y opciones: todos deben tener el mismo número de ítems y
 * exactamente una etiqueta por valor de respuesta.
 */
function validateLanguages(
  languages: InstrumentLanguages,
  optionValues: readonly number[],
  errors: ValidationIssue[],
): void {
  const codes = Object.keys(languages);
  const referenceCode = codes[0];

  if (referenceCode === undefined) {
    return;
  }

  const reference = languages[referenceCode];

  if (reference === undefined) {
    return;
  }

  const itemCount = reference.items.length;

  for (const code of codes) {
    const language = languages[code];

    if (language === undefined) {
      continue;
    }

    if (language.items.length !== itemCount) {
      errors.push({
        path: `languages.${code}.items`,
        message: `must have the same number of items as other languages (${itemCount})`,
      });
    }

    if (language.options.length !== optionValues.length) {
      errors.push({
        path: `languages.${code}.options`,
        message: `must have one option label per option value (${optionValues.length})`,
      });
    }
  }
}

/**
 * Comprueba que las bandas cubren exactamente la puntuación posible, sin huecos ni solapes.
 * Un hueco dejaría una puntuación sin nivel de riesgo; un solape haría ambiguo el resultado.
 */
function validateBands(
  bands: readonly Band[],
  minimumScore: number,
  maximumScore: number,
  errors: ValidationIssue[],
): void {
  const first = bands[0];
  const last = bands[bands.length - 1];
  const ids = new Set<string>();

  if (first !== undefined && first.min !== minimumScore) {
    errors.push({
      path: 'bands[0].min',
      message: `must be ${minimumScore} to cover the lowest possible score`,
    });
  }

  if (last !== undefined && last.max !== maximumScore) {
    errors.push({
      path: `bands[${bands.length - 1}].max`,
      message: `must be ${maximumScore} to cover the highest possible score`,
    });
  }

  bands.forEach((band, index) => {
    if (band.min > band.max) {
      errors.push({ path: `bands[${index}]`, message: 'min must not be greater than max' });
    }

    if (ids.has(band.id)) {
      errors.push({ path: `bands[${index}].id`, message: 'must be unique' });
    }

    ids.add(band.id);

    const previous = bands[index - 1];

    if (previous !== undefined && band.min !== previous.max + 1) {
      errors.push({
        path: `bands[${index}].min`,
        message: `must be ${previous.max + 1} so bands are contiguous and do not overlap`,
      });
    }
  });
}

/**
 * Comprueba que el ítem de seguridad existe y que su umbral es alcanzable. Si el umbral fuera el
 * valor máximo, la alerta nunca podría activarse, lo que sería un fallo de seguridad silencioso.
 */
function validateSafetyItem(
  safetyItem: SafetyItem,
  itemCount: number,
  optionValues: readonly number[],
  errors: ValidationIssue[],
): void {
  if (safetyItem.index >= itemCount) {
    errors.push({
      path: 'safetyItem.index',
      message: `must be between 0 and ${itemCount - 1}`,
    });
  }

  if (!optionValues.includes(safetyItem.alertWhenAbove)) {
    errors.push({
      path: 'safetyItem.alertWhenAbove',
      message: 'must be one of the option values',
    });
    return;
  }

  const maximumOption = optionValues[optionValues.length - 1];

  if (maximumOption !== undefined && safetyItem.alertWhenAbove >= maximumOption) {
    errors.push({
      path: 'safetyItem.alertWhenAbove',
      message: 'must be lower than the highest option value so an alert is possible',
    });
  }
}

/**
 * Valida un instrumento desconocido (por ejemplo, el JSON de `content/instruments/`) y devuelve
 * una copia tipada solo si cumple todas las reglas. Acumula todos los errores encontrados para
 * facilitar la corrección del archivo de contenido.
 */
export function validateInstrument(value: unknown): ValidationResult<Instrument> {
  const errors: ValidationIssue[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: [{ path: 'instrument', message: 'must be an object' }] };
  }

  const id = readNonEmptyString(value, 'id', 'id', errors);
  const version = readNonEmptyString(value, 'version', 'version', errors);
  const source = readNonEmptyString(value, 'source', 'source', errors);
  const licenceStatus = readNonEmptyString(value, 'licenceStatus', 'licenceStatus', errors);
  const status = value.status;

  if (status !== 'SAMPLE') {
    errors.push({ path: 'status', message: "must be 'SAMPLE'" });
  }

  const languages = readLanguages(value.languages, errors);
  const optionValues = readOptionValues(value.optionValues, errors);
  const bands = readBands(value.bands, errors);
  const safetyItem = readSafetyItem(value.safetyItem, errors);

  if (languages && optionValues) {
    validateLanguages(languages, optionValues, errors);
  }

  if (languages && optionValues && bands) {
    const itemCount = languages.es.items.length;
    const minimumOption = optionValues[0];
    const maximumOption = optionValues[optionValues.length - 1];

    if (minimumOption !== undefined && maximumOption !== undefined) {
      validateBands(bands, itemCount * minimumOption, itemCount * maximumOption, errors);
    }
  }

  if (languages && optionValues && safetyItem) {
    validateSafetyItem(safetyItem, languages.es.items.length, optionValues, errors);
  }

  if (
    errors.length > 0 ||
    status !== 'SAMPLE' ||
    id === undefined ||
    version === undefined ||
    source === undefined ||
    licenceStatus === undefined ||
    languages === undefined ||
    optionValues === undefined ||
    bands === undefined ||
    safetyItem === undefined
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      id,
      version,
      status,
      source,
      licenceStatus,
      languages,
      optionValues,
      bands,
      safetyItem,
    },
  };
}
