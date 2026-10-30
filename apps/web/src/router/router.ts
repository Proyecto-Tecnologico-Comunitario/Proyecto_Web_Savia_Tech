// SPDX-License-Identifier: GPL-3.0-or-later

import { HOME_ROUTE, type Route } from './routes';

/** Vista actual: la app o la pantalla neutral de la salida rápida. */
export type RouterView = 'app' | 'neutral';

/** Instantánea inmutable del router para `useSyncExternalStore`. */
export interface RouterSnapshot {
  readonly view: RouterView;
  readonly route: Route;
  readonly canGoBack: boolean;
}

/** API mínima del router en memoria. */
export interface Router {
  /** Se suscribe a los cambios; devuelve la forma de cancelar la suscripción. */
  subscribe(listener: () => void): () => void;
  /** Devuelve la instantánea actual; es estable mientras no haya cambios. */
  getSnapshot(): RouterSnapshot;
  /** Apila una ruta; repetir la ruta actual no hace nada. */
  navigate(route: Route): void;
  /** Retrocede una entrada si es posible. */
  back(): void;
  /** Vuelve al inicio y a la vista de la app; se usa al bloquear. */
  reset(): void;
  /** Muestra la pantalla neutral y descarta la pila de navegación. */
  showNeutral(): void;
  /** Vuelve de la pantalla neutral a la app. */
  leaveNeutral(): void;
}

/** Crea un router en memoria con pila de navegación. */
export function createRouter(): Router {
  // La pila nunca queda vacía: el inicio es la base.
  let stack: readonly Route[] = [HOME_ROUTE];
  let view: RouterView = 'app';
  const listeners = new Set<() => void>();

  /** Ruta superior de la pila. */
  function currentRoute(): Route {
    return stack[stack.length - 1] ?? HOME_ROUTE;
  }

  /** Construye una instantánea nueva a partir del estado actual. */
  function makeSnapshot(): RouterSnapshot {
    return {
      view,
      route: currentRoute(),
      canGoBack: view === 'app' && stack.length > 1,
    };
  }

  // La instantánea inicial se crea una sola vez.
  let snapshot = makeSnapshot();

  /** Notifica a los suscriptores solo si algo cambió. */
  function publish(): void {
    const next = makeSnapshot();

    // Se comparan por nombre de ruta para no notificar por objetos equivalentes.
    if (
      next.view === snapshot.view &&
      next.route.name === snapshot.route.name &&
      next.canGoBack === snapshot.canGoBack
    ) {
      return;
    }

    snapshot = next;

    // Una suscripción defectuosa no debe impedir que las demás se actualicen.
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // Sin consola: la UI no puede filtrar datos por un fallo de suscripción.
      }
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      return snapshot;
    },

    navigate(route) {
      // La pantalla neutral no navega: evita que un evento tardío revele una pantalla de la app.
      if (view !== 'app') {
        return;
      }

      // Navegar a la ruta actual no apila una entrada duplicada.
      if (currentRoute().name === route.name) {
        return;
      }

      stack = [...stack, route];
      publish();
    },

    back() {
      // En neutral no se retrocede a una pantalla sensible.
      if (view !== 'app' || stack.length <= 1) {
        return;
      }

      stack = stack.slice(0, -1);
      publish();
    },

    reset() {
      stack = [HOME_ROUTE];
      view = 'app';
      publish();
    },

    showNeutral() {
      stack = [HOME_ROUTE];
      view = 'neutral';
      publish();
    },

    leaveNeutral() {
      view = 'app';
      publish();
    },
  };
}
