// SPDX-License-Identifier: GPL-3.0-or-later

import type { RefObject } from 'react';

/** Propiedades de un campo de PIN. */
interface PinInputProps {
  /** Identificador único del campo, también usado por la etiqueta. */
  readonly id: string;
  /** Texto de la etiqueta, ya traducido. */
  readonly label: string;
  /** Referencia al input; el valor nunca se copia a estado de React. */
  readonly inputRef: RefObject<HTMLInputElement | null>;
  /** Enfoca el campo al montar. */
  readonly autoFocus?: boolean;
}

/**
 * Campo de PIN no controlado.
 *
 * El valor vive solo en el DOM hasta que el formulario lo lee y lo vacía en `finally`. No se usa
 * `value`/`onChange` para que el PIN no pase por el estado de React ni por herramientas de desarrollo.
 */
export function PinInput({ id, label, inputRef, autoFocus = false }: PinInputProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        ref={inputRef}
        id={id}
        name={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
      />
    </div>
  );
}
