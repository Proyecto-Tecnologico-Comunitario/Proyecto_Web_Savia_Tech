// SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from 'vitest';

import { estimateStorage, requestPersistentStorage } from '../persistence';

/** Sustituye `navigator.storage` por un doble de prueba. */
function stubStorage(storage: unknown): void {
  vi.stubGlobal('navigator', { storage });
}

afterEach(() => {
  // Se restaura cualquier global sustituido por una prueba.
  vi.unstubAllGlobals();
});

describe('requestPersistentStorage', () => {
  it('returns granted when the browser persists the origin', async () => {
    // El doble concede la persistencia.
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persist });

    await expect(requestPersistentStorage()).resolves.toBe('granted');
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('returns denied when the browser rejects the request', async () => {
    // La API existe, pero el navegador no concede la persistencia.
    stubStorage({ persist: vi.fn().mockResolvedValue(false) });

    await expect(requestPersistentStorage()).resolves.toBe('denied');
  });

  it('returns denied when the persistence call fails', async () => {
    // Un error de la API no debe propagarse al arranque de la app.
    stubStorage({ persist: vi.fn().mockRejectedValue(new Error('synthetic failure')) });

    await expect(requestPersistentStorage()).resolves.toBe('denied');
  });

  it('returns unsupported when navigator.storage is missing', async () => {
    // Un navegador sin StorageManager no puede conceder persistencia.
    vi.stubGlobal('navigator', {});

    await expect(requestPersistentStorage()).resolves.toBe('unsupported');
  });

  it('returns unsupported when the persist method is missing', async () => {
    // La presencia del objeto no garantiza que exista el método.
    stubStorage({ estimate: vi.fn() });

    await expect(requestPersistentStorage()).resolves.toBe('unsupported');
  });
});

describe('estimateStorage', () => {
  it('returns usage and quota when the browser supports estimation', async () => {
    // Las cifras son sintéticas y no representan datos reales.
    stubStorage({
      estimate: vi.fn().mockResolvedValue({ usage: 1_024, quota: 8_192 }),
    });

    await expect(estimateStorage()).resolves.toEqual({ usage: 1_024, quota: 8_192 });
  });

  it('returns null when estimation is not supported', async () => {
    // Sin `navigator.storage` no hay estimación posible.
    vi.stubGlobal('navigator', {});

    await expect(estimateStorage()).resolves.toBeNull();
  });

  it('returns null when the estimate is incomplete or invalid', async () => {
    // Los campos opcionales ausentes o no finitos no se convierten en cifras falsas.
    stubStorage({ estimate: vi.fn().mockResolvedValue({ usage: 1_024 }) });
    await expect(estimateStorage()).resolves.toBeNull();

    stubStorage({ estimate: vi.fn().mockResolvedValue({ usage: Number.NaN, quota: 8_192 }) });
    await expect(estimateStorage()).resolves.toBeNull();

    stubStorage({ estimate: vi.fn().mockResolvedValue({ usage: -1, quota: 8_192 }) });
    await expect(estimateStorage()).resolves.toBeNull();
  });

  it('returns null when the estimation call fails', async () => {
    // Un error de la API no debe romper la pantalla de ajustes.
    stubStorage({ estimate: vi.fn().mockRejectedValue(new Error('synthetic failure')) });

    await expect(estimateStorage()).resolves.toBeNull();
  });
});
