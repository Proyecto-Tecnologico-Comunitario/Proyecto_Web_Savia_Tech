// SPDX-License-Identifier: MIT

/**
 * Punto de entrada público de `@saviatech/rules`.
 *
 * Este paquete contiene el motor puro de SaviaTech: validación de instrumentos, puntuación, bandas
 * de riesgo y alerta de seguridad. No debe importar DOM, IndexedDB, red ni código de React.
 */

export type {
  AnswerInput,
  Band,
  Instrument,
  InstrumentLanguage,
  InstrumentLanguages,
  InstrumentStatus,
  SafetyItem,
  ScreeningResult,
  ValidationIssue,
  ValidationResult,
} from './types';

export { validateInstrument } from './instrument';
export {
  bandForScore,
  evaluateScreening,
  hasSafetyAlert,
  scoreAnswers,
  validateAnswers,
} from './scoring';
