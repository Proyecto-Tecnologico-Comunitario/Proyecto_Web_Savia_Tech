// SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from '../../i18n/I18nProvider';
import { LanguageToggle } from './LanguageToggle';
import { QuickExitButton } from './QuickExitButton';

/** Propiedades del encabezado de las pantallas desbloqueadas. */
interface HeaderProps {
  /** Bloquea la bóveda y vuelve al inicio. */
  readonly onLock: () => void;
  /** Acción síncrona de salida rápida. */
  readonly onQuickExit: () => void;
  /** Abre Ajustes. */
  readonly onSettings: () => void;
  /** Indica si se muestra el acceso a Ajustes (se oculta dentro de Ajustes). */
  readonly showSettings: boolean;
}

/**
 * Encabezado de la app desbloqueada.
 *
 * La salida rápida queda siempre en el extremo derecho, en la misma posición que en las pantallas de
 * PIN. Los controles son botones nativos para conservar foco y teclado.
 */
export function Header({ onLock, onQuickExit, onSettings, showSettings }: HeaderProps) {
  const { t } = useI18n();

  return (
    <header className="app-header">
      <div className="app-header-actions">
        {showSettings ? (
          <button type="button" className="button button-secondary" onClick={onSettings}>
            {t('header.settings')}
          </button>
        ) : null}
        <LanguageToggle />
        <button type="button" className="button button-secondary" onClick={onLock}>
          {t('header.lock')}
        </button>
        <QuickExitButton onClick={onQuickExit} />
      </div>
    </header>
  );
}
