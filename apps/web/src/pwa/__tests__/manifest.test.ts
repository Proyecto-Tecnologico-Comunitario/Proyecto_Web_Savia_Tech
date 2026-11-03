// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import {
  APP_NAME_MAX_LENGTH,
  buildManifest,
  MANIFEST_BACKGROUND_COLOR,
  MANIFEST_THEME_COLOR,
  normaliseBasePath,
} from '../manifest';

describe('normaliseBasePath', () => {
  it('falls back to the root path when the value is missing or empty', () => {
    expect(normaliseBasePath(undefined)).toBe('/');
    expect(normaliseBasePath('')).toBe('/');
    expect(normaliseBasePath('   ')).toBe('/');
  });

  it('keeps a valid subpath', () => {
    expect(normaliseBasePath('/savia/')).toBe('/savia/');
  });

  it.each(['savia', '/savia', '/../', '//', '/savia?x/', '/savia#x/', '/sa via/'])(
    'rejects the invalid base path %s',
    (base) => {
      expect(() => normaliseBasePath(base)).toThrow();
    },
  );
});

describe('buildManifest', () => {
  it('uses the approved defaults for SaviaTech at the root path', () => {
    const manifest = buildManifest({ name: 'SaviaTech' });

    expect(manifest.name).toBe('SaviaTech');
    expect(manifest.short_name).toBe('SaviaTech');
    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('es');
    expect(manifest.background_color).toBe(MANIFEST_BACKGROUND_COLOR);
    expect(manifest.theme_color).toBe(MANIFEST_THEME_COLOR);
  });

  it('accepts a custom name and short name', () => {
    const manifest = buildManifest({ name: 'SaviaTech Field', shortName: 'Savia' });

    expect(manifest.name).toBe('SaviaTech Field');
    expect(manifest.short_name).toBe('Savia');
  });

  it('keeps the base path in the identity fields and icons', () => {
    const manifest = buildManifest({ name: 'SaviaTech', base: '/savia/' });

    expect(manifest.id).toBe('/savia/');
    expect(manifest.start_url).toBe('/savia/');
    expect(manifest.scope).toBe('/savia/');
    expect(manifest.icons.map((icon) => icon.src)).toEqual([
      '/savia/icons/icon-192.png',
      '/savia/icons/icon-512.png',
      '/savia/icons/icon-maskable-512.png',
    ]);
  });

  it('rejects an empty name', () => {
    expect(() => buildManifest({ name: '   ' })).toThrow();
  });

  it('accepts a name of 45 characters and rejects 46', () => {
    expect(() => buildManifest({ name: 'a'.repeat(APP_NAME_MAX_LENGTH) })).not.toThrow();
    expect(() => buildManifest({ name: 'a'.repeat(APP_NAME_MAX_LENGTH + 1) })).toThrow();
  });

  it('derives the short name from the first 12 characters', () => {
    const manifest = buildManifest({ name: 'Community care platform' });

    expect(manifest.short_name).toBe('Community ca');
    expect(manifest.short_name).toHaveLength(12);
  });

  it('does not include fields outside the approved subset', () => {
    const manifest = buildManifest({ name: 'SaviaTech' });
    const forbidden = [
      'description',
      'categories',
      'shortcuts',
      'screenshots',
      'share_target',
      'file_handlers',
      'protocol_handlers',
      'related_applications',
      'orientation',
    ];

    for (const field of forbidden) {
      expect(manifest).not.toHaveProperty(field);
    }
  });

  it('keeps the default manifest free of sensitive terms', () => {
    const manifest = buildManifest({ name: 'SaviaTech' });
    const serialised = JSON.stringify(manifest).toLowerCase();

    for (const term of [
      'violencia',
      'violence',
      'mujer',
      'woman',
      'riesgo',
      'risk',
      'tamizaje',
      'screening',
    ]) {
      expect(serialised).not.toContain(term);
    }
  });

  it('rejects names with sensitive terms, including accented spellings', () => {
    expect(() => buildManifest({ name: 'Violencia' })).toThrow();
    expect(() => buildManifest({ name: 'Riesgó' })).toThrow();
    expect(() => buildManifest({ name: 'SaviaTech', shortName: 'Screening' })).toThrow();
  });

  it('declares exactly the three expected icons', () => {
    const manifest = buildManifest({ name: 'SaviaTech' });

    expect(manifest.icons).toEqual([
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ]);
  });
});
