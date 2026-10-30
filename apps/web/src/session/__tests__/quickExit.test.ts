// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from 'vitest';

import { createQuickExit } from '../quickExit';

describe('quick exit', () => {
  it('locks first and then neutralises the screen', () => {
    // Se registra el orden exacto de los cuatro pasos.
    const calls: string[] = [];

    const exit = createQuickExit({
      lock: () => calls.push('lock'),
      showNeutral: () => calls.push('neutral'),
      replaceHistory: () => calls.push('history'),
      setTitle: () => calls.push('title'),
    });

    exit();

    expect(calls).toEqual(['lock', 'neutral', 'history', 'title']);
  });

  it('still neutralises the screen when locking fails', () => {
    // Un fallo del llavero no puede dejar la pantalla sensible visible.
    const calls: string[] = [];

    const exit = createQuickExit({
      lock: () => {
        calls.push('lock');
        throw new Error('lock failed');
      },
      showNeutral: () => calls.push('neutral'),
      replaceHistory: () => calls.push('history'),
      setTitle: () => calls.push('title'),
    });

    expect(() => exit()).not.toThrow();
    expect(calls).toEqual(['lock', 'neutral', 'history', 'title']);
  });

  it('continues with history and title when the router fails', () => {
    // El paso intermedio no debe impedir los siguientes.
    const calls: string[] = [];

    const exit = createQuickExit({
      lock: () => calls.push('lock'),
      showNeutral: () => {
        calls.push('neutral');
        throw new Error('router failed');
      },
      replaceHistory: () => calls.push('history'),
      setTitle: () => calls.push('title'),
    });

    expect(() => exit()).not.toThrow();
    expect(calls).toEqual(['lock', 'neutral', 'history', 'title']);
  });

  it('never throws even when every step fails', () => {
    // La salida rápida es una acción de pánico: no puede romper la app.
    const exit = createQuickExit({
      lock: () => {
        throw new Error('lock failed');
      },
      showNeutral: () => {
        throw new Error('router failed');
      },
      replaceHistory: () => {
        throw new Error('history failed');
      },
      setTitle: () => {
        throw new Error('title failed');
      },
    });

    expect(() => exit()).not.toThrow();
  });

  it('is synchronous so it can run from a global keyboard handler', () => {
    // No debe devolver una promesa: el manejador de teclado no espera.
    const lock = vi.fn();
    const exit = createQuickExit({
      lock,
      showNeutral: vi.fn(),
      replaceHistory: vi.fn(),
      setTitle: vi.fn(),
    });

    expect(exit()).toBeUndefined();
    expect(lock).toHaveBeenCalledTimes(1);
  });
});
