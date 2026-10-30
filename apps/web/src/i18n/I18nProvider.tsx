// SPDX-License-Identifier: GPL-3.0-or-later

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { SettingsStore } from '../settings/settingsStore';
import {
  detectLocale,
  type Locale,
  type MessageKey,
  translate,
  type TranslateParams,
} from './index';

/** Valor que consumen las pantallas para traducir textos. */
export interface I18nContextValue {
  /** Idioma activo. */
  readonly locale: Locale;
  /** Traduce una clave con parámetros opcionales. */
  readonly t: (key: MessageKey, params?: TranslateParams) => string;
  /** Cambia el idioma y lo persiste en Ajustes. */
  readonly setLocale: (locale: Locale) => void;
}

/** Contexto interno; `null` significa que falta el proveedor. */
const I18nContext = createContext<I18nContextValue | null>(null);

/** Propiedades del proveedor de idioma. */
interface I18nProviderProps {
  readonly settings: SettingsStore;
  readonly children: ReactNode;
}

/**
 * Proveedor de idioma hecho a mano.
 *
 * El idioma guardado se lee antes de montar la compuerta para que la pantalla de PIN ya salga en el
 * idioma elegido. Si no hay idioma guardado se detecta a partir del navegador.
 */
export function I18nProvider({ settings, children }: I18nProviderProps) {
  // El idioma inicial se calcula una sola vez al montar.
  const [locale, setLocaleState] = useState<Locale>(() => {
    // Un idioma persistido tiene prioridad sobre la detección del navegador.
    const stored = settings.load().locale;
    if (stored !== null) {
      return stored;
    }

    // En un entorno sin `navigator` (pruebas) se usa español.
    const languages = typeof navigator === 'undefined' ? [] : navigator.languages;
    return detectLocale(languages);
  });

  // El atributo `lang` del documento acompaña siempre al idioma activo.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Cambiar idioma actualiza el estado, persiste y vuelve a renderizar sin recargar.
  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      settings.saveLocale(next);
    },
    [settings],
  );

  // La función de traducción se recrea solo cuando cambia el idioma.
  const t = useCallback(
    (key: MessageKey, params?: TranslateParams) => translate(locale, key, params),
    [locale],
  );

  // El valor del contexto se memoiza para no invalidar a los consumidores en cada render.
  const value = useMemo<I18nContextValue>(() => ({ locale, t, setLocale }), [locale, t, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Devuelve el contexto de idioma y falla si se usa fuera del proveedor. */
export function useI18n(): I18nContextValue {
  // Se lee el contexto creado por `I18nProvider`.
  const context = useContext(I18nContext);

  // Usarlo fuera del proveedor sería un error de programación.
  if (context === null) {
    throw new Error('useI18n must be used within I18nProvider');
  }

  return context;
}
