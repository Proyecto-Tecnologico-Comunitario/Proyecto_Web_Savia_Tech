// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { AUTO_LOCK_OPTIONS_MS, createSettingsStore, DEFAULT_AUTO_LOCK_MS } from '../settingsStore';

/** Almacenamiento falso en memoria para no depender de `localStorage`. */
interface FakeStorage {
  readonly values: Map<string, string>;
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
}

/** Crea un almacenamiento falso con los valores iniciales indicados. */
function createFakeStorage(initial: Record<string, string> = {}): FakeStorage {
  // Se parte de una copia para que cada prueba tenga su propio estado.
  const values = new Map<string, string>(Object.entries(initial));

  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('settingsStore', () => {
  it('returns the defaults when there is no storage', () => {
    // Un contexto sin almacenamiento sigue funcionando en memoria.
    const store = createSettingsStore(null);
    expect(store.load()).toEqual({ locale: null, autoLockMs: DEFAULT_AUTO_LOCK_MS });
  });

  it('returns the defaults for invalid JSON', () => {
    // Un JSON corrupto no puede romper el arranque.
    const store = createSettingsStore(createFakeStorage({ 'saviatech.settings': '{not json' }));
    expect(store.load()).toEqual({ locale: null, autoLockMs: DEFAULT_AUTO_LOCK_MS });
  });

  it('returns the defaults for wrong field types', () => {
    // Tipos incorrectos se sustituyen campo a campo por sus valores de reserva.
    const store = createSettingsStore(
      createFakeStorage({ 'saviatech.settings': '{"locale":42,"autoLockMs":"soon"}' }),
    );
    expect(store.load()).toEqual({ locale: null, autoLockMs: DEFAULT_AUTO_LOCK_MS });
  });

  it('keeps a valid locale but resets a time outside the allowed list', () => {
    // Un tiempo manipulado en `localStorage` cae a dos minutos.
    const store = createSettingsStore(
      createFakeStorage({ 'saviatech.settings': '{"locale":"en","autoLockMs":45000}' }),
    );
    expect(store.load()).toEqual({ locale: 'en', autoLockMs: DEFAULT_AUTO_LOCK_MS });
  });

  it('survives storage that throws on read or write', () => {
    // Se simula un modo privado que lanza en ambas operaciones.
    const throwingStorage = {
      getItem: () => {
        throw new Error('read blocked');
      },
      setItem: () => {
        throw new Error('write blocked');
      },
    };

    const store = createSettingsStore(throwingStorage);
    expect(store.load()).toEqual({ locale: null, autoLockMs: DEFAULT_AUTO_LOCK_MS });

    // Guardar no debe propagar el fallo de cuota.
    expect(() => {
      store.saveLocale('en');
      store.saveAutoLockMs(60_000);
    }).not.toThrow();

    // Los valores siguen disponibles en memoria.
    expect(store.load()).toEqual({ locale: 'en', autoLockMs: 60_000 });
  });

  it('persists only the two allowed fields', () => {
    // El JSON guardado debe ser pequeño y auditable.
    const storage = createFakeStorage();
    const store = createSettingsStore(storage);

    store.saveLocale('en');
    store.saveAutoLockMs(300_000);

    const raw = storage.values.get('saviatech.settings');
    expect(raw).toBeDefined();
    expect(JSON.parse(raw ?? '{}')).toEqual({ locale: 'en', autoLockMs: 300_000 });
  });

  it('rejects a time outside the allowed list', () => {
    // `45_000` no es una opción de la interfaz y no debe guardarse.
    const storage = createFakeStorage();
    const store = createSettingsStore(storage);

    store.saveAutoLockMs(45_000);

    expect(store.load().autoLockMs).toBe(DEFAULT_AUTO_LOCK_MS);
    expect(storage.values.has('saviatech.settings')).toBe(false);
  });

  it('accepts every allowed auto-lock option', () => {
    // La lista cerrada es la única fuente de opciones válidas.
    for (const option of AUTO_LOCK_OPTIONS_MS) {
      const store = createSettingsStore(null);
      store.saveAutoLockMs(option);
      expect(store.load().autoLockMs).toBe(option);
    }
  });
});
