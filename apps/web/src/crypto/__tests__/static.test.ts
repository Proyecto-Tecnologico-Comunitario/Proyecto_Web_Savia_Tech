// SPDX-License-Identifier: GPL-3.0-or-later

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** Directorio fuente del módulo de cifrado. */
const cryptoDirectory = fileURLToPath(new URL('..', import.meta.url));

/** Directorio fuente de la capa de almacenamiento. */
const storageDirectory = fileURLToPath(new URL('../../storage/', import.meta.url));

/** Directorio fuente del modelo de caso. */
const modelDirectory = fileURLToPath(new URL('../../model/', import.meta.url));

/** Patrones prohibidos en el código de producción del módulo. */
const forbiddenPatterns = [
  { label: 'Math.random', pattern: /Math\.random\s*\(/ },
  { label: 'console', pattern: /\bconsole\./ },
  { label: 'localStorage', pattern: /\blocalStorage\b/ },
  { label: 'sessionStorage', pattern: /\bsessionStorage\b/ },
  {
    label: 'external crypto import',
    pattern:
      /(?:from\s*|import\s*\()\s*['"](?:node:)?(?:crypto|crypto-js|node-forge|sjcl|tweetnacl|libsodium-wrappers)(?:\/[^'"]*)?['"]/,
  },
];

/** Lista recursivamente los archivos de producción, sin entrar en `__tests__`. */
async function collectSourceFiles(directory: string): Promise<string[]> {
  // Se leen las entradas del directorio actual.
  const entries = await readdir(directory, { withFileTypes: true });

  // Se acumulan las rutas relativas de los archivos TypeScript de producción.
  const files: string[] = [];

  // Se recorre cada entrada del directorio.
  for (const entry of entries) {
    // Las pruebas no son código de producción y no se revisan con esta regla.
    if (entry.isDirectory() && entry.name !== '__tests__') {
      // Un subdirectorio futuro también debe quedar cubierto.
      const nested = await collectSourceFiles(join(directory, entry.name));
      files.push(...nested.map((file) => join(entry.name, file)));
      continue;
    }

    // Solo se revisan archivos TypeScript que no sean pruebas.
    if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(entry.name);
    }
  }

  return files;
}

/** Comprueba que un directorio de producción no usa APIs prohibidas. */
async function expectDirectoryIsClean(directory: string): Promise<void> {
  // Se listan recursivamente los archivos TypeScript de producción.
  const sourceFiles = await collectSourceFiles(directory);

  // La prueba debe cubrir al menos los archivos principales.
  expect(sourceFiles.length).toBeGreaterThan(0);

  // Se revisa cada archivo de producción.
  for (const fileName of sourceFiles) {
    // Se lee el contenido completo.
    const source = await readFile(join(directory, fileName), 'utf8');

    // Se comprueban todos los patrones prohibidos.
    for (const { label, pattern } of forbiddenPatterns) {
      // El mensaje incluye el archivo para facilitar la auditoría.
      expect(source, `${fileName} must not use ${label}`).not.toMatch(pattern);
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
});
