// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Estado puro del flujo de nuevo caso.
 *
 * La creación del caso ocurre fuera de este módulo, al aceptar el consentimiento. Aquí solo se
 * modela la compuerta: sin la casilla marcada no se puede pasar a `consent-accepted`, y por tanto
 * la interfaz no debe llamar al repositorio.
 */

/** Pasos del consentimiento. */
export type NewCaseStep = 'consent-pending' | 'consent-accepted';

/** Estado del flujo de nuevo caso. */
export interface NewCaseState {
  readonly step: NewCaseStep;
  /** La casilla de consentimiento está marcada. */
  readonly consentChecked: boolean;
}

/** Acciones que la pantalla puede despachar. */
export type NewCaseAction =
  | { readonly type: 'setConsentChecked'; readonly checked: boolean }
  | { readonly type: 'acceptConsent' }
  | { readonly type: 'reset' };

/** Estado inicial: consentimiento sin marcar. */
export function initialNewCaseState(): NewCaseState {
  return { step: 'consent-pending', consentChecked: false };
}

/** Indica si el botón de continuar debe estar habilitado. */
export function canAcceptConsent(state: NewCaseState): boolean {
  return state.step === 'consent-pending' && state.consentChecked;
}

/**
 * Reduce una acción al siguiente estado. Una transición inválida devuelve el mismo objeto para que
 * la interfaz pueda comparar por referencia y no vuelva a renderizar sin motivo.
 */
export function reduceNewCase(state: NewCaseState, action: NewCaseAction): NewCaseState {
  switch (action.type) {
    case 'setConsentChecked': {
      // La casilla solo se puede cambiar antes de aceptar; después ya no hay nada que marcar.
      if (state.step !== 'consent-pending') {
        return state;
      }

      if (state.consentChecked === action.checked) {
        return state;
      }

      return { ...state, consentChecked: action.checked };
    }

    case 'acceptConsent': {
      // Sin la casilla marcada no se crea ningún caso, aunque la acción llegue por error.
      if (!canAcceptConsent(state)) {
        return state;
      }

      return { ...state, step: 'consent-accepted' };
    }

    case 'reset': {
      return initialNewCaseState();
    }

    default: {
      return state;
    }
  }
}
