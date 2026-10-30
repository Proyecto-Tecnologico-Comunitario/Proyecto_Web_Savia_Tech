// SPDX-License-Identifier: GPL-3.0-or-later

import { LanguageToggle } from './LanguageToggle';
import { QuickExitButton } from './QuickExitButton';

/** Propiedades de la barra de herramientas de las pantallas de PIN. */
interface SessionToolbarProps {
  /** Acción síncrona de salida rápida. */
  readonly onQuickExit: () => void;
}

/**
 * Barra superior de las pantallas de PIN.
 *
 * La salida rápida y el cambio de idioma siguen activos aunque el formulario esté ocupado. No hay
 * botón de bloqueo porque la bóveda ya está bloqueada.
 */
export function SessionToolbar({ onQuickExit }: SessionToolbarProps) {
  return (
    <div className="toolbar">
      <LanguageToggle />
      <QuickExitButton onClick={onQuickExit} />
    </div>
  );
}
