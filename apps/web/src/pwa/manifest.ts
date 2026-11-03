// SPDX-License-Identifier: GPL-3.0-or-later

/** Longitud máxima permitida para el nombre de la aplicación. */
export const APP_NAME_MAX_LENGTH = 45;

/** Longitud del nombre corto cuando no se configura uno propio. */
export const SHORT_NAME_FALLBACK_LENGTH = 12;

/** Ruta base por defecto de la aplicación. */
export const DEFAULT_BASE_PATH = '/';

/** Color del tema y del fondo; coincide con `--color-bg` del modo claro. */
export const MANIFEST_THEME_COLOR = '#ffffff';
export const MANIFEST_BACKGROUND_COLOR = '#ffffff';

/** Entrada de la función pura que construye el manifiesto. */
export interface ManifestInput {
  readonly name: string;
  readonly shortName?: string | undefined;
  readonly base?: string | undefined;
}

/** Ícono declarado en el manifiesto. */
export interface ManifestIcon {
  readonly src: string;
  readonly sizes: string;
  readonly type: 'image/png';
  readonly purpose?: 'any' | 'maskable';
}

/** Subconjunto mínimo del manifiesto web que necesita la aplicación. */
export interface WebAppManifest {
  readonly name: string;
  readonly short_name: string;
  readonly id: string;
  readonly start_url: string;
  readonly scope: string;
  readonly display: 'standalone';
  readonly lang: 'es';
  readonly background_color: string;
  readonly theme_color: string;
  readonly icons: ManifestIcon[];
}

/**
 * Términos que no deben aparecer en el manifiesto.
 * El nombre y el ícono instalados son visibles en la pantalla de inicio y en el conmutador de apps;
 * un teléfono inspeccionado no debe revelar el propósito de la aplicación.
 */
const SENSITIVE_TERMS = [
  'violencia',
  'violence',
  'mujer',
  'woman',
  'women',
  'riesgo',
  'risk',
  'tamizaje',
  'screening',
  'salud mental',
  'mental health',
] as const;

/** Quita acentos y pasa a minúsculas para comparar sin depender de la escritura. */
function normaliseForCheck(value: string): string {
  // NFD separa la letra de su diacrítico; el rango U+0300–U+036F elimina las marcas.
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Falla si alguno de los textos contiene un término sensible. */
function assertNoSensitiveTerms(values: readonly string[]): void {
  for (const value of values) {
    const normalised = normaliseForCheck(value);
    if (SENSITIVE_TERMS.some((term) => normalised.includes(term))) {
      // El mensaje no repite el término para no filtrarlo a los registros del build.
      throw new Error('Manifest text must not contain sensitive terms.');
    }
  }
}

/**
 * Normaliza la ruta base del manifiesto.
 * Solo se aceptan rutas absolutas y cerradas con `/`, sin segmentos ambiguos.
 */
export function normaliseBasePath(raw: string | undefined): string {
  const value = raw?.trim() ?? '';

  // Sin valor se usa la raíz aprobada para la demo.
  if (value === '') {
    return DEFAULT_BASE_PATH;
  }

  // La base debe ser absoluta y terminar en `/` para que las rutas relativas resuelvan bien.
  if (!value.startsWith('/') || !value.endsWith('/')) {
    throw new Error('Base path must start and end with "/".');
  }

  // `//`, `..`, barras invertidas, consultas, fragmentos y espacios producen URLs ambiguas.
  if (
    value.includes('//') ||
    value.includes('..') ||
    value.includes('\\') ||
    value.includes('?') ||
    value.includes('#') ||
    /\s/.test(value)
  ) {
    throw new Error('Base path contains an invalid segment.');
  }

  return value;
}

/** Construye el manifiesto web a partir de la configuración de entorno. */
export function buildManifest(input: ManifestInput): WebAppManifest {
  const name = input.name.trim();

  // El nombre es obligatorio y acotado para que quepa en el lanzador del sistema.
  if (name.length === 0 || name.length > APP_NAME_MAX_LENGTH) {
    throw new Error(`Manifest name must be between 1 and ${APP_NAME_MAX_LENGTH} characters.`);
  }

  // Un nombre corto propio también debe caber; si falta, se derivan los primeros caracteres.
  const shortName = (input.shortName ?? '').trim() || name.slice(0, SHORT_NAME_FALLBACK_LENGTH);
  if (shortName.length > APP_NAME_MAX_LENGTH) {
    throw new Error(`Manifest short name must be at most ${APP_NAME_MAX_LENGTH} characters.`);
  }

  const base = normaliseBasePath(input.base);

  // El nombre y el nombre corto quedan visibles fuera de la aplicación.
  assertNoSensitiveTerms([name, shortName, base]);

  return {
    name,
    short_name: shortName,
    id: base,
    start_url: base,
    scope: base,
    display: 'standalone',
    lang: 'es',
    background_color: MANIFEST_BACKGROUND_COLOR,
    theme_color: MANIFEST_THEME_COLOR,
    icons: [
      {
        src: `${base}icons/icon-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${base}icons/icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${base}icons/icon-maskable-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
