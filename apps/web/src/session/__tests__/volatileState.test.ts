// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from 'vitest';

import { createVolatileStateRegistry } from '../volatileState';

describe('volatile state registry', () => {
  it('runs every registered cleaner on clearAll', () => {
    // Se registran tres limpiezas independientes.
    const registry = createVolatileStateRegistry();
    const first = vi.fn();
    const second = vi.fn();
    const third = vi.fn();

    registry.register(first);
    registry.register(second);
    registry.register(third);

    // Un bloqueo debe descartar todo el estado volátil.
    registry.clearAll();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).toHaveBeenCalledTimes(1);
  });

  it('continues with the remaining cleaners when one throws', () => {
    // La primera limpieza falla; las demás deben ejecutarse igualmente.
    const registry = createVolatileStateRegistry();
    const first = vi.fn(() => {
      throw new Error('cleaner failed');
    });
    const second = vi.fn();

    registry.register(first);
    registry.register(second);

    expect(() => registry.clearAll()).not.toThrow();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops calling a cleaner after its registration is cancelled', () => {
    // Se cancela el registro antes del bloqueo.
    const registry = createVolatileStateRegistry();
    const cleaner = vi.fn();
    const unregister = registry.register(cleaner);

    unregister();
    unregister();
    registry.clearAll();

    expect(cleaner).not.toHaveBeenCalled();
  });

  it('keeps registrations across clearAll so later locks still clear state', () => {
    // El registro describe cómo limpiar, no un evento único: debe sobrevivir a cada bloqueo.
    const registry = createVolatileStateRegistry();
    const cleaner = vi.fn();

    registry.register(cleaner);
    registry.clearAll();
    registry.clearAll();

    expect(cleaner).toHaveBeenCalledTimes(2);
  });
});
