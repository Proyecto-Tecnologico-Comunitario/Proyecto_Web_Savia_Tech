// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { startAutoLock } from '../autoLock';

/** Temporizador falso con control manual del reloj. */
interface FakeTimer {
  readonly id: number;
  readonly at: number;
  readonly callback: () => void;
}

/** Reloj y programador falsos para probar el auto-lock sin esperas reales. */
function createFakeClock(start = 0) {
  let current = start;
  let nextId = 1;
  const timers = new Map<number, FakeTimer>();

  return {
    now: () => current,
    setTimer: (callback: () => void, delayMs: number): unknown => {
      // Se guarda el instante absoluto para poder simular temporizadores retrasados.
      const id = nextId;
      nextId += 1;
      timers.set(id, { id, at: current + delayMs, callback });
      return id;
    },
    clearTimer: (handle: unknown): void => {
      // El handle es el identificador numérico devuelto por setTimer.
      timers.delete(handle as number);
    },
    advance: (delayMs: number): void => {
      // Solo se mueve el reloj; los temporizadores se ejecutan con runDue.
      current += delayMs;
    },
    runDue: (): void => {
      // Se ejecutan los vencidos en orden, incluidos los que reprogramen otro temporizador.
      for (;;) {
        const due = [...timers.values()]
          .filter((timer) => timer.at <= current)
          .sort((left, right) => left.at - right.at)[0];

        if (due === undefined) {
          return;
        }

        timers.delete(due.id);
        due.callback();
      }
    },
    pending: () => timers.size,
  };
}

/** Entorno de prueba con estado mutable de la bóveda. */
function createEnvironment(initialUnlocked = true, initialTimeoutMs = 120_000) {
  const clock = createFakeClock();
  const documentEvents = new EventTarget();
  const windowEvents = new EventTarget();
  let unlocked = initialUnlocked;
  let timeoutMs = initialTimeoutMs;
  let hidden = false;
  let lockCalls = 0;

  const autoLock = startAutoLock({
    isUnlocked: () => unlocked,
    lock: () => {
      lockCalls += 1;
      unlocked = false;
    },
    getTimeoutMs: () => timeoutMs,
    documentEvents,
    windowEvents,
    isHidden: () => hidden,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  return {
    clock,
    documentEvents,
    windowEvents,
    autoLock,
    setUnlocked: (value: boolean): void => {
      unlocked = value;
    },
    setTimeoutMs: (value: number): void => {
      timeoutMs = value;
    },
    setHidden: (value: boolean): void => {
      hidden = value;
    },
    lockCalls: () => lockCalls,
  };
}

describe('auto lock', () => {
  it('locks after the configured timeout', () => {
    // Con dos minutos de plazo, el temporizador debe disparar al cumplirse.
    const environment = createEnvironment();

    expect(environment.clock.pending()).toBe(1);

    environment.clock.advance(120_000);
    environment.clock.runDue();

    expect(environment.lockCalls()).toBe(1);
  });

  it('restarts the deadline on user activity', () => {
    // La actividad reinicia el plazo; no basta con que pase el tiempo total.
    const environment = createEnvironment();

    environment.clock.advance(100_000);
    environment.documentEvents.dispatchEvent(new Event('pointerdown'));
    environment.clock.advance(100_000);
    environment.clock.runDue();

    expect(environment.lockCalls()).toBe(0);

    environment.clock.advance(20_001);
    environment.clock.runDue();

    expect(environment.lockCalls()).toBe(1);
  });

  it('uses the latest timeout after explicit activity', () => {
    // Cambiar el plazo en ajustes debe aplicarse sin reiniciar el auto-lock.
    const environment = createEnvironment();

    environment.clock.advance(10_000);
    environment.setTimeoutMs(60_000);
    environment.autoLock.notifyActivity();

    environment.clock.advance(59_999);
    environment.clock.runDue();
    expect(environment.lockCalls()).toBe(0);

    environment.clock.advance(1);
    environment.clock.runDue();
    expect(environment.lockCalls()).toBe(1);
  });

  it('does not lock an already locked vault', () => {
    // Sin bóveda desbloqueada no hay temporizador ni bloqueo.
    const environment = createEnvironment(false);

    expect(environment.clock.pending()).toBe(0);

    environment.clock.advance(200_000);
    environment.clock.runDue();
    environment.setHidden(true);
    environment.documentEvents.dispatchEvent(new Event('visibilitychange'));
    environment.windowEvents.dispatchEvent(new Event('pagehide'));

    expect(environment.lockCalls()).toBe(0);
  });

  it('locks immediately when the tab is hidden', () => {
    // Ocultar la pestaña equivale a guardar el teléfono: se bloquea al instante.
    const environment = createEnvironment();

    environment.setHidden(true);
    environment.documentEvents.dispatchEvent(new Event('visibilitychange'));

    expect(environment.lockCalls()).toBe(1);
  });

  it('locks on pagehide', () => {
    // Cerrar o descargar la página no puede dejar la clave en memoria.
    const environment = createEnvironment();

    environment.windowEvents.dispatchEvent(new Event('pagehide'));

    expect(environment.lockCalls()).toBe(1);
  });

  it('checks the real elapsed time when the tab becomes visible again', () => {
    // Los navegadores retrasan temporizadores en segundo plano; al volver se comprueba el reloj.
    const environment = createEnvironment();

    environment.clock.advance(130_000);
    environment.documentEvents.dispatchEvent(new Event('visibilitychange'));

    expect(environment.lockCalls()).toBe(1);
  });

  it('locks when a delayed timer fires after the deadline', () => {
    // El temporizador puede llegar tarde; el cálculo usa el tiempo real transcurrido.
    const environment = createEnvironment();

    environment.clock.advance(200_000);
    environment.clock.runDue();

    expect(environment.lockCalls()).toBe(1);
  });

  it('stops the timer and removes listeners', () => {
    // Detener una instancia no debe dejar closures ni listeners activos.
    const environment = createEnvironment();

    environment.autoLock.stop();
    environment.clock.advance(200_000);
    environment.clock.runDue();
    environment.documentEvents.dispatchEvent(new Event('pointerdown'));
    environment.windowEvents.dispatchEvent(new Event('pagehide'));

    expect(environment.lockCalls()).toBe(0);
    expect(environment.clock.pending()).toBe(0);
  });

  it('can stop one of two instances without affecting the other', () => {
    // En desarrollo, React puede montar dos instancias; detener una no debe desactivar la otra.
    const clock = createFakeClock();
    const documentEvents = new EventTarget();
    const windowEvents = new EventTarget();
    let unlocked = true;
    let lockCalls = 0;

    const options = {
      isUnlocked: () => unlocked,
      lock: () => {
        lockCalls += 1;
        unlocked = false;
      },
      getTimeoutMs: () => 120_000,
      documentEvents,
      windowEvents,
      isHidden: () => false,
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    };

    const first = startAutoLock(options);
    const second = startAutoLock(options);

    first.stop();
    clock.advance(120_000);
    clock.runDue();

    expect(lockCalls).toBe(1);

    second.stop();
  });
});
