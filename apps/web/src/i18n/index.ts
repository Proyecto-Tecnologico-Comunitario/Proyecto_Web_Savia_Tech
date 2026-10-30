// SPDX-License-Identifier: GPL-3.0-or-later

import en from './en.json';
import es from './es.json';

/** Idiomas soportados por la aplicación. */
export type Locale = 'es' | 'en';

/** Claves de traducción disponibles, derivadas del archivo español. */
export type MessageKey = keyof typeof es;

/** Valores admitidos en los marcadores `{nombre}` de una traducción. */
export type TranslateParams = Readonly<Record<string, string | number>>;

/**
 * El inglés se tipa contra las claves del español.
 *
 * Si `en.json` pierde o añade una clave, la compilación falla. La prueba de paridad añade una
 * comprobación en tiempo de ejecución para detectar el mismo problema en los datos.
 */
const enMessages: Record<MessageKey, string> = en;

/** Mensajes de cada idioma. */
const messages: Record<Locale, Record<MessageKey, string>> = {
  es,
  en: enMessages,
};

/** Comprueba si un valor desconocido es un idioma soportado. */
export function isLocale(value: unknown): value is Locale {
  // Solo se aceptan los dos idiomas declarados.
  return value === 'es' || value === 'en';
}

/**
 * Traduce una clave y sustituye los marcadores `{nombre}`.
 *
 * Si falta un parámetro, el marcador se deja tal cual para que el fallo sea visible sin romper la
 * interfaz ni mostrar datos internos.
 */
export function translate(locale: Locale, key: MessageKey, params?: TranslateParams): string {
  // Se obtiene la plantilla del idioma elegido.
  const template = messages[locale][key];

  // Sin parámetros se devuelve el texto tal cual.
  if (params === undefined) {
    return template;
  }

  // Se sustituyen solo los marcadores presentes en los parámetros.
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    // `noUncheckedIndexedAccess` obliga a tratar el valor como posiblemente ausente.
    const value = params[name];

    // Un parámetro ausente conserva el marcador original.
    return value === undefined ? placeholder : String(value);
  });
}

/**
 * Detecta el idioma inicial a partir de los idiomas del navegador.
 *
 * El español es el valor de reserva. Solo se usa cuando no hay un idioma guardado en Ajustes.
 */
export function detectLocale(languages: readonly string[]): Locale {
  // Se mira únicamente el primer idioma, como indica la especificación.
  const first = languages[0]?.toLowerCase();

  // Un navegador en inglés empieza por `en`; cualquier otro caso usa español.
  return first !== undefined && first.startsWith('en') ? 'en' : 'es';
}
