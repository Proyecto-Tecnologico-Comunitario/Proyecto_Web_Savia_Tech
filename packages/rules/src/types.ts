// SPDX-License-Identifier: MIT

/**
 * Tipos públicos del motor de reglas.
 *
 * El motor es puro: no accede al DOM, al almacenamiento ni a la red. Recibe datos ya
 * deserializados y devuelve resultados o errores de validación. Esto permite reutilizarlo en la
 * app web y en cualquier cliente futuro, y probarlo de forma aislada.
 */

/** Versión del contenido. En v1 todo instrumento debe declararse como muestra sin revisar. */
export type InstrumentStatus = 'SAMPLE';

/** Rango de puntuaciones que comparten una misma etiqueta de riesgo. */
export interface Band {
  readonly id: string;
  readonly min: number;
  readonly max: number;
}

/** Textos de un instrumento en un idioma concreto. */
export interface InstrumentLanguage {
  readonly title: string;
  readonly items: readonly string[];
  readonly options: readonly string[];
}

/**
 * Idiomas del instrumento. `es` y `en` son obligatorios porque v1 debe funcionar en ambos; se
 * permiten otros códigos para contenido futuro.
 */
export interface InstrumentLanguages {
  readonly es: InstrumentLanguage;
  readonly en: InstrumentLanguage;
  readonly [code: string]: InstrumentLanguage;
}

/**
 * Ítem de seguridad. `index` es la posición basada en cero dentro de la lista de ítems y
 * `alertWhenAbove` es el valor de respuesta a partir del cual se muestra la alerta.
 */
export interface SafetyItem {
  readonly index: number;
  readonly alertWhenAbove: number;
}

/** Instrumento validado y listo para puntuar. Solo se construye a través de `validateInstrument`. */
export interface Instrument {
  readonly id: string;
  readonly version: string;
  readonly status: InstrumentStatus;
  readonly source: string;
  readonly licenceStatus: string;
  readonly languages: InstrumentLanguages;
  readonly optionValues: readonly number[];
  readonly bands: readonly Band[];
  readonly safetyItem: SafetyItem;
}

/** Un problema concreto de validación, con la ruta del campo afectado. */
export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Resultado de validación explícito. Evita excepciones en datos que vienen de archivos y obliga
 * a quien llama a tratar el caso de error antes de usar el valor.
 */
export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly ValidationIssue[] };

/** Respuesta de un ítem. `null` y `undefined` representan un ítem todavía sin responder. */
export type AnswerInput = number | null | undefined;

/** Resultado explicable de un cribado: puntuación, banda calculada y alerta de seguridad. */
export interface ScreeningResult {
  readonly score: number;
  readonly bandId: string;
  readonly safetyAlert: boolean;
}
