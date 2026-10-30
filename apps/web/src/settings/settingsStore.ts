// SPDX-License-Identifier: GPL-3.0-or-later

import type { Locale } from '../i18n';

/** Opciones de bloqueo automático permitidas, en milisegundos. */
export const AUTO_LOCK_OPTIONS_MS = [60_000, 120_000, 300_000] as const;

/** Tiempo de bloqueo automático por defecto: dos minutos. */
export const DEFAULT_AUTO_LOCK_MS = 120_000;

/** Clave única de los ajustes no sensibles en `localStorage`. */
const SETTINGS_KEY = 'saviatech.settings';

/** Ajustes que deben estar disponibles antes de desbloquear la bóveda. */
export interface AppSettings {
  /** Idioma elegido; `null` significa que todavía no se ha elegido uno. */
  readonly locale: Locale | null;
  /** Tiempo de bloqueo automático en milisegundos. */
  readonly autoLockMs: number;
}

/** Contrato de persistencia de ajustes. */
export interface SettingsStore {
  /** Devuelve una copia de los ajustes actuales. */
  load(): AppSettings;
  /** Guarda el idioma elegido. */
  saveLocale(locale: Locale): void;
  /** Guarda el tiempo de auto-lock; ignora valores fuera de la lista permitida. */
  saveAutoLockMs(ms: number): void;
}

/** Valores por defecto cuando no hay nada válido guardado. */
const DEFAULT_SETTINGS: AppSettings = {
  locale: null,
  autoLockMs: DEFAULT_AUTO_LOCK_MS,
};

/** Comprueba si un valor es una opción de auto-lock permitida. */
function isAutoLockMs(value: unknown): value is (typeof AUTO_LOCK_OPTIONS_MS)[number] {
  // La lista es corta y cerrada; se compara explícitamente para no aceptar valores manipulados.
  return value === 60_000 || value === 120_000 || value === 300_000;
}

/** Normaliza un objeto leído de `localStorage` sin lanzar nunca. */
function normaliseSettings(raw: unknown): AppSettings {
  // Un valor que no es un objeto vuelve a los valores por defecto.
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_SETTINGS;
  }

  // Se leen los dos únicos campos permitidos.
  const record = raw as Record<string, unknown>;

  // Un idioma desconocido se trata como «sin elegir»; un tiempo inválido vuelve a dos minutos.
  return {
    locale: record.locale === 'es' || record.locale === 'en' ? record.locale : null,
    autoLockMs: isAutoLockMs(record.autoLockMs) ? record.autoLockMs : DEFAULT_AUTO_LOCK_MS,
  };
}

/** Obtiene el `localStorage` del navegador sin romper en contextos restringidos. */
function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    // Es la única referencia a `localStorage` del código de producción.
    return globalThis.localStorage ?? null;
  } catch {
    // En modo privado o con cookies bloqueadas el acceso puede lanzar.
    return null;
  }
}

/** Lee y valida los ajustes guardados. */
function readSettings(storage: Pick<Storage, 'getItem' | 'setItem'> | null): AppSettings {
  // Sin almacenamiento se usan los valores en memoria.
  if (storage === null) {
    return DEFAULT_SETTINGS;
  }

  try {
    // La clave contiene un único JSON con solo los dos campos no sensibles.
    const serialised = storage.getItem(SETTINGS_KEY);

    // La ausencia de la clave es el estado inicial normal.
    if (serialised === null) {
      return DEFAULT_SETTINGS;
    }

    // Cualquier JSON inválido o con tipos erróneos se normaliza sin lanzar.
    return normaliseSettings(JSON.parse(serialised) as unknown);
  } catch {
    // Un almacenamiento que lanza o un JSON corrupto no impiden usar la app.
    return DEFAULT_SETTINGS;
  }
}

/**
 * Crea el almacén de ajustes.
 *
 * `storage` se inyecta para poder probarlo en Node. En producción se usa `localStorage`, que es la
 * única excepción a la regla de no guardar datos en almacenamiento web: estos dos valores no son
 * sensibles y deben leerse antes de desbloquear la bóveda.
 */
export function createSettingsStore(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = defaultStorage(),
): SettingsStore {
  // El estado en memoria es la fuente de verdad durante la sesión.
  let current = readSettings(storage);

  /** Persiste el estado completo; un fallo de cuota no rompe la app. */
  function persist(next: AppSettings): void {
    // Sin almacenamiento la app sigue funcionando con los valores en memoria.
    if (storage === null) {
      return;
    }

    try {
      // Se guarda un único JSON para que la clave sea fácil de auditar.
      storage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Cuota agotada o modo privado: se conserva el valor en memoria.
    }
  }

  return {
    load() {
      // Se devuelve una copia para que nadie mute el estado interno por accidente.
      return { ...current };
    },

    saveLocale(locale) {
      // El tipo ya garantiza que el idioma es válido.
      current = { ...current, locale };
      persist(current);
    },

    saveAutoLockMs(ms) {
      // Un valor fuera de la lista se rechaza sin tocar el valor actual.
      if (!isAutoLockMs(ms)) {
        return;
      }

      current = { ...current, autoLockMs: ms };
      persist(current);
    },
  };
}
