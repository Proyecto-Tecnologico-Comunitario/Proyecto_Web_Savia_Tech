// SPDX-License-Identifier: GPL-3.0-or-later

import { AppProvider } from './app/AppContext';
import type { AppDependencies } from './app/createApp';
import { I18nProvider } from './i18n/I18nProvider';
import { Shell } from './ui/Shell';

/** Propiedades de la raíz React. */
interface AppProps {
  /** Dependencias creadas una sola vez en `main.tsx`. */
  readonly app: AppDependencies;
}

/** Monta los proveedores y la compuerta de acceso. */
export function App({ app }: AppProps) {
  return (
    <AppProvider app={app}>
      <I18nProvider settings={app.settings}>
        <Shell />
      </I18nProvider>
    </AppProvider>
  );
}
