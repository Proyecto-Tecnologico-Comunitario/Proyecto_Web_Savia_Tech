#!/usr/bin/env node
// SPDX-License-Identifier: MIT
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ALLOWED_LICENCES = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MIT-0',
  'Unlicense',
  'Zlib',
]);

function licenceOf(pkg) {
  if (typeof pkg.license === 'string') {
    return pkg.license;
  }

  if (pkg.license && typeof pkg.license.type === 'string') {
    return pkg.license.type;
  }

  if (Array.isArray(pkg.licenses)) {
    const types = pkg.licenses
      .map((entry) => (typeof entry === 'string' ? entry : entry?.type))
      .filter((entry) => typeof entry === 'string');
    return types.length > 0 ? types.join(' OR ') : null;
  }

  return null;
}

function isAllowed(expression) {
  const alternatives = expression.split(/\s+OR\s+/i);

  return alternatives.some((alternative) => {
    const terms = alternative.split(/\s+AND\s+/i);

    return terms.every((term) => {
      const base = term
        .replace(/[()]/g, '')
        .split(/\s+WITH\s+/i)[0]
        .trim()
        .replace(/\*$/, '');

      return ALLOWED_LICENCES.has(base);
    });
  });
}

async function inspectPackage(directory, packages) {
  const manifestPath = path.join(directory, 'package.json');

  if (!existsSync(manifestPath)) {
    return;
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  if (manifest.private !== true) {
    packages.set(`${manifest.name}@${manifest.version}`, {
      name: manifest.name ?? directory,
      version: manifest.version ?? 'unknown',
      licence: licenceOf(manifest),
    });
  }

  const nested = path.join(directory, 'node_modules');
  if (existsSync(nested)) {
    await scanNodeModules(nested, packages);
  }
}

async function scanNodeModules(directory, packages) {
  if (!existsSync(directory)) {
    return;
  }

  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);

    if (entry.name.startsWith('@')) {
      const scopedEntries = await readdir(entryPath, { withFileTypes: true });
      for (const scopedEntry of scopedEntries) {
        await inspectPackage(path.join(entryPath, scopedEntry.name), packages);
      }
      continue;
    }

    if (entry.isDirectory() || entry.isSymbolicLink()) {
      await inspectPackage(entryPath, packages);
    }
  }
}

const packages = new Map();
await scanNodeModules(path.resolve('node_modules'), packages);

const violations = [];
const licenceCounts = new Map();

for (const pkg of packages.values()) {
  if (!pkg.licence || !isAllowed(pkg.licence)) {
    violations.push(pkg);
    continue;
  }

  licenceCounts.set(pkg.licence, (licenceCounts.get(pkg.licence) ?? 0) + 1);
}

const summary = [...licenceCounts.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([licence, count]) => `  ${licence}: ${count}`)
  .join('\n');

console.log(`Checked ${packages.size} third-party packages.`);
console.log(`Allowed licence expressions in use:\n${summary || '  (none)'}`);

if (violations.length > 0) {
  console.error('\nDisallowed or missing licences:');
  for (const pkg of violations) {
    console.error(`  ${pkg.name}@${pkg.version}: ${pkg.licence ?? 'missing'}`);
  }
  console.error(
    '\nOnly OSI-approved permissive licences are allowed. Ask before adding a dependency.',
  );
  process.exit(1);
}

console.log('\nAll dependency licences are permissive.');
