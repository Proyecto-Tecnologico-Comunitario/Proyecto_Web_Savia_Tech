// SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from '../../i18n/I18nProvider';

/** Propiedades del botón de salida rápida. */
interface QuickExitButtonProps {
  /** Acción síncrona de salida rápida. */
  readonly onClick: () => void;
}

/**
 * Botón de salida rápida.
 *
 * Es una acción de pánico: siempre visible, con estilo de peligro y sin confirmación. El nombre
 * accesible coincide con el texto visible.
 */
export function QuickExitButton({ onClick }: QuickExitButtonProps) {
  const { t } = useI18n();

  return (
    <button type="button" className="button button-danger" onClick={onClick}>
      {t('header.quickExit')}
    </button>
  );
}
