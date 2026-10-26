// SPDX-License-Identifier: MIT
import { validateInstrument } from './instrument';
import type { Instrument } from './types';

/**
 * Fixtures sintéticos para los tests del motor de reglas.
 *
 * No es contenido clínico: los ítems y las etiquetas son texto de relleno. El instrumento imita la
 * forma del PHQ-9 del spec (9 ítems, valores 0-3, bandas 0-27 y un ítem de seguridad) para poder
 * probar todos los límites sin depender de `content/`.
 */

export interface MutableInstrumentLanguage {
  title: string;
  items: string[];
  options: string[];
}

export interface MutableBand {
  id: string;
  min: number;
  max: number;
}

export interface MutableInstrument {
  id: string;
  version: string;
  status: string;
  source: string;
  licenceStatus: string;
  languages: {
    es: MutableInstrumentLanguage;
    en: MutableInstrumentLanguage;
    [code: string]: MutableInstrumentLanguage;
  };
  optionValues: number[];
  bands: MutableBand[];
  safetyItem: {
    index: number;
    alertWhenAbove: number;
  };
}

/** Crea un instrumento de prueba mutable para poder introducir un error por test. */
export function createInstrumentJson(): MutableInstrument {
  const itemsFor = (language: string): string[] =>
    Array.from({ length: 9 }, (_, index) => `${language} sample item ${index + 1}`);

  return {
    id: 'phq9-sample',
    version: '0.1',
    status: 'SAMPLE',
    source: 'Synthetic test fixture',
    licenceStatus: 'not-applicable',
    languages: {
      es: {
        title: 'Instrumento de muestra',
        items: itemsFor('es'),
        options: ['Nunca', 'Algunos días', 'Más de la mitad', 'Casi todos los días'],
      },
      en: {
        title: 'Sample instrument',
        items: itemsFor('en'),
        options: ['Not at all', 'Several days', 'More than half', 'Nearly every day'],
      },
    },
    optionValues: [0, 1, 2, 3],
    bands: [
      { id: 'minimal', min: 0, max: 4 },
      { id: 'mild', min: 5, max: 9 },
      { id: 'moderate', min: 10, max: 14 },
      { id: 'moderately-severe', min: 15, max: 19 },
      { id: 'severe', min: 20, max: 27 },
    ],
    safetyItem: { index: 8, alertWhenAbove: 0 },
  };
}

const fixtureValidation = validateInstrument(createInstrumentJson());

if (!fixtureValidation.ok) {
  throw new Error(`Invalid rules test fixture: ${JSON.stringify(fixtureValidation.errors)}`);
}

/** Instrumento validado que usan los tests de puntuación. */
export const sampleInstrument: Instrument = fixtureValidation.value;
