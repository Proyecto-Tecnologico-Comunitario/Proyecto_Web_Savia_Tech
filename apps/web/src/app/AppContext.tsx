// SPDX-License-Identifier: GPL-3.0-or-later

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import type { AppDependencies } from './createApp';

/** Contexto con las dependencias creadas una sola vez en `main.tsx`. */
const AppContext = createContext<AppDependencies | null>(null);

/** Propiedades del proveedor de dependencias. */
interface AppProviderProps {
  readonly app: AppDependencies;
  readonly children: ReactNode;
}

/** Provee las dependencias a las pantallas y componentes. */
export function AppProvider({ app, children }: AppProviderProps) {
  return <AppContext.Provider value={app}>{children}</AppContext.Provider>;
}

/** Devuelve las dependencias y falla si se usa fuera del proveedor. */
export function useApp(): AppDependencies {
  const app = useContext(AppContext);

  if (app === null) {
    throw new Error('useApp must be used within AppProvider');
  }

  return app;
}
