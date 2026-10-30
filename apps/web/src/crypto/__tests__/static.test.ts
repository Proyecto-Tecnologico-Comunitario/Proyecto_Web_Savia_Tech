// SPDX-License-Identifier: GPL-3.0-or-later

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** Directorio fuente de la aplicación web. */
const sourceDirectory = fileURLToPath(new URL('../../', import.meta.url));

/** Directorio fuente del módulo de cifrado. */
const cryptoDirectory = fileURLToPath(new URL('..', import.meta.url));

/** Directorio fuente de la capa de almacenamiento. */
const storageDirectory = fileURLToPath(new URL('../../storage/', import.meta.url));

/** Directorio fuente del modelo de caso. */
const modelDirectory = fileURLToPath(new URL('../../model/', import.meta.url));

/** Directorios de la tarea T5 que deben respetar las mismas reglas. */
const shellDirectories = ['session', 'router', 'i18n', 'ui', 'app'].map((name) =>
  fileURLToPath(new URL(`../../${name}/`, import.meta.url)),
);

/** Ruta relativa del único archivo autorizado a usar `localStorage`. */
const SETTINGS_STORE = join('settings', 'settingsStore.ts');

/** Patrón prohibido en el código de producción. */
interface ForbiddenPattern {
  readonly label: string;
  readonly pattern: RegExp;
  /** Solo `settings/settingsStore.ts` puede usar `localStorage`. */
  readonly allowSettingsStore?: boolean;
}

/** Patrones prohibidos en el código de producción. */
const forbiddenPatterns: readonly ForbiddenPattern[] = [
  { label: 'Math.random', pattern: /Math\.random\s*\(/ },
  { label: 'console', pattern: /\bconsole\./ },
  { label: 'localStorage', pattern: /\blocalStorage\b/, allowSettingsStore: true },
  { label: 'sessionStorage', pattern: /\bsessionStorage\b/ },
  { label: 'inline style attribute', pattern: /style\s*=/ },
  {
    label: 'external crypto import',
    pattern:
      /(?:from\s*|import\s*\()\s*['"](?:node:)?(?:crypto|crypto-js|node-forge|sjcl|tweetnacl|libsodium-wrappers)(?:\/[^'"]*)?['"]/,
  },
];

/**
 * Lista recursivamente los archivos TypeScript de producción.
 *
 * Se excluyen las pruebas y las declaraciones de tipos; también se omite `__tests__`.
 */
async function collectSourceFiles(directory: string, base: string = directory): Promise<string[]> {
  // Se leen las entradas del directorio actual.
  const entries = await readdir(directory, { withFileTypes: true });

  // Se acumulan las rutas relativas de los archivos de producción.
  const files: string[] = [];

  // Se recorre cada entrada del directorio.
  for (const entry of entries) {
    // Las pruebas no son código de producción y no se revisan con esta regla.
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') {
        continue;
      }

      // Un subdirectorio futuro también debe quedar cubierto.
      files.push(...(await collectSourceFiles(join(directory, entry.name), base)));
      continue;
    }

    // Solo se revisan archivos TypeScript y TSX que no sean pruebas ni declaraciones.
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

/** Comprueba que un directorio de producción no usa APIs prohibidas. */
async function expectDirectoryIsClean(directory: string, base: string = directory): Promise<void> {
  // Se listan recursivamente los archivos TypeScript de producción.
  const sourceFiles = await collectSourceFiles(directory, base);

  // La prueba debe cubrir al menos los archivos principales.
  expect(sourceFiles.length).toBeGreaterThan(0);

  // Se revisa cada archivo de producción.
  for (const fileName of sourceFiles) {
    // Se lee el contenido completo.
    const source = await readFile(join(base, fileName), 'utf8');

    // Se comprueban todos los patrones prohibidos.
    for (const rule of forbiddenPatterns) {
      // La excepción de `localStorage` solo aplica al almacén de ajustes.
      if (rule.allowSettingsStore === true && fileName === SETTINGS_STORE) {
        continue;
      }

      // El mensaje incluye el archivo para facilitar la auditoría.
      expect(source, `${fileName} must not use ${rule.label}`).not.toMatch(rule.pattern);
    }
  }
}

describe('static rules', () => {
  it('keeps crypto production files free of forbidden APIs', async () => {
    // La criptografía no puede usar aleatoriedad insegura, consola, web storage ni librerías externas.
    await expectDirectoryIsClean(cryptoDirectory);
  });

  it('keeps storage and model production files free of forbidden APIs', async () => {
    // La capa de datos tampoco puede filtrar datos por consola, web storage o aleatoriedad insegura.
    await expectDirectoryIsClean(storageDirectory);
    await expectDirectoryIsClean(modelDirectory);
  });

  it('keeps the T5 shell modules free of forbidden APIs', async () => {
    // Sesión, router, i18n y UI no pueden filtrar datos ni usar estilos en línea.
    for (const directory of shellDirectories) {
      await expectDirectoryIsClean(directory);
    }
  });

  it('keeps the rest of src free of forbidden APIs except settingsStore', async () => {
    // El resto de la app tampoco puede usar consola, aleatoriedad insegura ni almacenamiento web.
    // `settings/settingsStore.ts` es la única excepción y solo para `localStorage`.
    await expectDirectoryIsClean(sourceDirectory);
  });
});
