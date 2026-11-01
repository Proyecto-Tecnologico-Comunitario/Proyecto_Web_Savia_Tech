// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from 'vitest';

import { createRouter } from '../router';
import {
  caseDetailRoute,
  HOME_ROUTE,
  NEW_CASE_ROUTE,
  screeningRoute,
  SETTINGS_ROUTE,
} from '../routes';

describe('router', () => {
  it('starts at home with no back entry', () => {
    // Estado inicial: inicio, vista de app y sin historial.
    const router = createRouter();
    const snapshot = router.getSnapshot();

    expect(snapshot.view).toBe('app');
    expect(snapshot.route.name).toBe('home');
    expect(snapshot.canGoBack).toBe(false);
  });

  it('navigates forward and back', () => {
    // Se apila ajustes y se retrocede.
    const router = createRouter();

    router.navigate(SETTINGS_ROUTE);
    expect(router.getSnapshot().route.name).toBe('settings');
    expect(router.getSnapshot().canGoBack).toBe(true);

    router.back();
    expect(router.getSnapshot().route.name).toBe('home');
    expect(router.getSnapshot().canGoBack).toBe(false);
  });

  it('does not push a duplicate route or notify subscribers', () => {
    // Navegar a la ruta actual es un no-op.
    const router = createRouter();
    const listener = vi.fn();
    router.subscribe(listener);

    router.navigate(HOME_ROUTE);

    expect(listener).not.toHaveBeenCalled();
    expect(router.getSnapshot().canGoBack).toBe(false);
  });

  it('treats two cases as different screens even with the same route name', () => {
    // El identificador forma parte de la identidad de la pantalla.
    const router = createRouter();

    router.navigate(caseDetailRoute('case-a'));
    expect(router.getSnapshot().route).toEqual({ name: 'case-detail', caseId: 'case-a' });

    router.navigate(caseDetailRoute('case-b'));
    expect(router.getSnapshot().route).toEqual({ name: 'case-detail', caseId: 'case-b' });
    expect(router.getSnapshot().canGoBack).toBe(true);

    router.back();
    expect(router.getSnapshot().route).toEqual({ name: 'case-detail', caseId: 'case-a' });
  });

  it('replaces the top entry without growing the stack', () => {
    // Crear un caso sustituye el formulario por el tamizaje.
    const router = createRouter();

    router.navigate(NEW_CASE_ROUTE);
    router.replace(screeningRoute('case-a'));

    expect(router.getSnapshot().route).toEqual({ name: 'screening', caseId: 'case-a' });
    expect(router.getSnapshot().canGoBack).toBe(true);

    router.back();
    expect(router.getSnapshot().route.name).toBe('home');
    expect(router.getSnapshot().canGoBack).toBe(false);
  });

  it('collapses an adjacent duplicate when replacing', () => {
    // Detalle → tamizaje → detalle no debe dejar dos detalles seguidos.
    const router = createRouter();

    router.navigate(caseDetailRoute('case-a'));
    router.navigate(screeningRoute('case-a'));
    router.replace(caseDetailRoute('case-a'));

    expect(router.getSnapshot().route).toEqual({ name: 'case-detail', caseId: 'case-a' });
    expect(router.getSnapshot().canGoBack).toBe(true);

    router.back();
    expect(router.getSnapshot().route.name).toBe('home');
  });

  it('ignores replace while the neutral screen is shown', () => {
    // Un evento tardío no puede cambiar la pantalla neutral.
    const router = createRouter();

    router.showNeutral();
    router.replace(screeningRoute('case-a'));

    expect(router.getSnapshot().view).toBe('neutral');
    expect(router.getSnapshot().route.name).toBe('home');
  });

  it('returns a stable snapshot until something changes', () => {
    // `useSyncExternalStore` exige estabilidad referencial.
    const router = createRouter();
    const first = router.getSnapshot();

    expect(router.getSnapshot()).toBe(first);

    router.navigate(SETTINGS_ROUTE);

    expect(router.getSnapshot()).not.toBe(first);
  });

  it('ignores navigation while the neutral screen is shown', () => {
    // Un evento tardío no puede revelar una pantalla de la app durante la salida rápida.
    const router = createRouter();

    router.navigate(SETTINGS_ROUTE);
    router.showNeutral();

    expect(router.getSnapshot().view).toBe('neutral');
    expect(router.getSnapshot().route.name).toBe('home');
    expect(router.getSnapshot().canGoBack).toBe(false);

    router.navigate(SETTINGS_ROUTE);
    router.back();

    expect(router.getSnapshot().route.name).toBe('home');
  });

  it('leaves the neutral screen at home', () => {
    // Volver de neutral siempre aterriza en el inicio.
    const router = createRouter();

    router.navigate(SETTINGS_ROUTE);
    router.showNeutral();
    router.leaveNeutral();

    expect(router.getSnapshot().view).toBe('app');
    expect(router.getSnapshot().route.name).toBe('home');
    expect(router.getSnapshot().canGoBack).toBe(false);
  });

  it('resets to home from any route', () => {
    // El bloqueo reinicia la navegación.
    const router = createRouter();

    router.navigate(SETTINGS_ROUTE);
    router.reset();

    expect(router.getSnapshot().view).toBe('app');
    expect(router.getSnapshot().route.name).toBe('home');
    expect(router.getSnapshot().canGoBack).toBe(false);
  });

  it('stops notifying after unsubscribe', () => {
    // La suscripción se puede cancelar sin efectos posteriores.
    const router = createRouter();
    const listener = vi.fn();
    const unsubscribe = router.subscribe(listener);

    unsubscribe();
    router.navigate(SETTINGS_ROUTE);

    expect(listener).not.toHaveBeenCalled();
  });
});
