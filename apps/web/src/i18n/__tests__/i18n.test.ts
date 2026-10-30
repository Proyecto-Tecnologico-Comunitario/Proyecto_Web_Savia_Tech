// SPDX-License-Identifier: GPL-3.0-or-later

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import en from '../en.json';
import es from '../es.json';
import { detectLocale, translate } from '../index';

/** Directorio fuente de la aplicación web. */
const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));

/** Lista recursivamente los archivos TypeScript de producción. */
async function collectSourceFiles(directory: string, base: string = directory): Promise<string[]> {
  // Se leen las entradas del directorio actual.
  const entries = await readdir(directory, { withFileTypes: true });

  // Se acumulan las rutas relativas.
  const files: string[] = [];

  // Se recorre cada entrada.
  for (const entry of entries) {
    // Las pruebas no cuentan como uso de una clave en la interfaz.
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') {
        continue;
      }

      files.push(...(await collectSourceFiles(join(directory, entry.name), base)));
      continue;
    }

    // Solo se revisan TypeScript y TSX de producción.
    if (
      entry.isFile() &&
      /\.(?:ts|tsx)$/.test(entry.name) &&
      !/\.test\.(?:ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith('.d.ts')
    ) {
      files.push(relative(base, join(directory, entry.name)));
    }
  }

  return files;
}

/** Devuelve todo el código fuente de producción concatenado. */
async function readSource(): Promise<string> {
  // Se listan los archivos de producción.
  const files = await collectSourceFiles(sourceRoot);

  // Se leen y concatenan para poder buscar claves literales.
  const contents = await Promise.all(files.map((file) => readFile(join(sourceRoot, file), 'utf8')));

  return contents.join('\n');
}

/** Extrae los nombres de parámetros `{nombre}` de un texto. */
function parametersOf(text: string): string[] {
  // Se recogen todos los marcadores sin repetir.
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '');
}

describe('i18n messages', () => {
  it('keeps exactly the same keys in Spanish and English', () => {
    // La paridad de claves se comprueba también al compilar, pero un JSON editado a mano puede
    // colarse sin pasar por tipos.
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it('has no empty strings', () => {
    // Ningún texto visible puede quedar vacío.
    for (const [locale, messages] of Object.entries({ es, en })) {
      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim(), `${locale}.${key} must not be empty`).not.toBe('');
      }
    }
  });

  it('keeps every Spanish parameter in the English text', () => {
    // Un parámetro olvidado en inglés dejaría un `{seconds}` visible en la interfaz.
    for (const [key, value] of Object.entries(es)) {
      const english = (en as Record<string, string>)[key] ?? '';
      expect(parametersOf(english), `en.${key} is missing a parameter`).toEqual(
        expect.arrayContaining(parametersOf(value)),
      );
    }
  });

  it('uses every key in production source and references no missing key', async () => {
    // Se lee el código de producción, sin pruebas, para comprobar el uso real de las claves.
    const source = await readSource();

    // Todas las claves de `es.json` deben aparecer como literal en algún archivo de producción.
    // Si T6 deja una clave preparada, se añade aquí una lista blanca comentada con su motivo.
    for (const key of Object.keys(es)) {
      expect(
        source.includes(`'${key}'`) || source.includes(`"${key}"`),
        `es.${key} is not used in production source`,
      ).toBe(true);
    }

    // Las llamadas literales a `t('clave')` no pueden referenciar una clave inexistente.
    const literalKeys = new Set<string>();

    for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
      const key = match[1];

      if (key !== undefined) {
        literalKeys.add(key);
      }
    }

    for (const key of literalKeys) {
      expect(Object.keys(es), `missing translation for ${key}`).toContain(key);
    }
  });
});

describe('translate', () => {
  it('replaces parameters with strings and numbers', () => {
    // Los dos tipos de parámetro se convierten a texto.
    expect(translate('es', 'settings.autolock.option', { minutes: 5 })).toBe('5 min');
    expect(translate('en', 'settings.storage.usage', { usage: 1.5, quota: 10 })).toBe(
      '1.5 MB used of 10 MB',
    );
  });

  it('leaves an unknown parameter marker untouched', () => {
    // Un parámetro ausente no rompe la pantalla ni muestra datos internos.
    expect(translate('es', 'pin.error.wait', {})).toBe(
      'Demasiados intentos. Espera {seconds} s para volver a intentar.',
    );
  });
});

describe('detectLocale', () => {
  it('uses English when the first browser language starts with en', () => {
    // Se ignoran los idiomas posteriores.
    expect(detectLocale(['en-US', 'es-CO'])).toBe('en');
    expect(detectLocale(['EN'])).toBe('en');
  });

  it('falls back to Spanish for any other language or an empty list', () => {
    // El español es el valor de reserva.
    expect(detectLocale(['es-CO'])).toBe('es');
    expect(detectLocale(['fr-FR'])).toBe('es');
    expect(detectLocale([])).toBe('es');
  });
});
