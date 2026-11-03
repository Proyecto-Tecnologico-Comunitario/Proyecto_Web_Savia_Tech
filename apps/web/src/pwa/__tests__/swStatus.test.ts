// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from 'vitest';

import { createSwStatus, type SwCallbacks, type SwRegistration } from '../swStatus';

/** Promesa controlable para resolver o rechazar el registro desde la prueba. */
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/** Registro mínimo que no hace nada; sirve para las pruebas que no aplican actualizaciones. */
function idleRegistration(): SwRegistration {
  return { update: async () => undefined };
}

describe('createSwStatus', () => {
  it('stays unsupported and does not register when the API is missing', async () => {
    const register = vi.fn<() => Promise<SwRegistration>>();
    const status = createSwStatus({
      isSupported: () => false,
      register,
      isVaultUnlocked: () => false,
    });

    expect(status.getState()).toBe('unsupported');

    await status.start();

    expect(status.getState()).toBe('unsupported');
    expect(register).not.toHaveBeenCalled();
  });

  it('goes from registering to offlineReady when the registration resolves', async () => {
    const pending = deferred<SwRegistration>();
    const status = createSwStatus({
      isSupported: () => true,
      register: () => pending.promise,
      isVaultUnlocked: () => false,
    });

    expect(status.getState()).toBe('registering');

    const started = status.start();
    expect(status.getState()).toBe('registering');

    pending.resolve(idleRegistration());
    await started;

    expect(status.getState()).toBe('offlineReady');
  });

  it('marks offlineReady when the callback fires', async () => {
    let callbacks: SwCallbacks | undefined;
    const status = createSwStatus({
      isSupported: () => true,
      register: async (received) => {
        callbacks = received;
        return idleRegistration();
      },
      isVaultUnlocked: () => false,
    });

    await status.start();
    callbacks?.onOfflineReady();

    expect(status.getState()).toBe('offlineReady');
  });

  it('marks updateAvailable when the callback fires', async () => {
    let callbacks: SwCallbacks | undefined;
    const status = createSwStatus({
      isSupported: () => true,
      register: async (received) => {
        callbacks = received;
        return idleRegistration();
      },
      isVaultUnlocked: () => false,
    });

    await status.start();
    callbacks?.onNeedRefresh();

    expect(status.getState()).toBe('updateAvailable');
  });

  it('marks error when the registration rejects', async () => {
    const status = createSwStatus({
      isSupported: () => true,
      register: async () => {
        throw new Error('registration failed');
      },
      isVaultUnlocked: () => false,
    });

    await status.start();

    expect(status.getState()).toBe('error');
  });

  it('marks error when the registration reports an error', async () => {
    let callbacks: SwCallbacks | undefined;
    const status = createSwStatus({
      isSupported: () => true,
      register: async (received) => {
        callbacks = received;
        return idleRegistration();
      },
      isVaultUnlocked: () => false,
    });

    await status.start();
    callbacks?.onError(new Error('boom'));

    expect(status.getState()).toBe('error');
  });

  it('cannot apply an update that the browser has not detected', async () => {
    const status = createSwStatus({
      isSupported: () => true,
      register: async () => idleRegistration(),
      isVaultUnlocked: () => false,
    });

    await status.start();

    await expect(status.applyUpdate()).resolves.toBe('unavailable');
  });

  it('blocks the update while the vault is unlocked', async () => {
    const update = vi.fn(async () => undefined);
    let callbacks: SwCallbacks | undefined;
    const status = createSwStatus({
      isSupported: () => true,
      register: async (received) => {
        callbacks = received;
        return { update };
      },
      isVaultUnlocked: () => true,
    });

    await status.start();
    callbacks?.onNeedRefresh();

    await expect(status.applyUpdate()).resolves.toBe('blocked');
    expect(update).not.toHaveBeenCalled();
  });

  it('applies the update once the vault is locked', async () => {
    const update = vi.fn(async () => undefined);
    let callbacks: SwCallbacks | undefined;
    const status = createSwStatus({
      isSupported: () => true,
      register: async (received) => {
        callbacks = received;
        return { update };
      },
      isVaultUnlocked: () => false,
    });

    await status.start();
    callbacks?.onNeedRefresh();

    await expect(status.applyUpdate()).resolves.toBe('applied');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(true);
  });

  it('reports error and unavailable when applying the update fails', async () => {
    const update = vi.fn(async () => {
      throw new Error('update failed');
    });
    let callbacks: SwCallbacks | undefined;
    const status = createSwStatus({
      isSupported: () => true,
      register: async (received) => {
        callbacks = received;
        return { update };
      },
      isVaultUnlocked: () => false,
    });

    await status.start();
    callbacks?.onNeedRefresh();

    await expect(status.applyUpdate()).resolves.toBe('unavailable');
    expect(status.getState()).toBe('error');
  });

  it('registers only once when start is called twice', async () => {
    const pending = deferred<SwRegistration>();
    const register = vi.fn(() => pending.promise);
    const status = createSwStatus({
      isSupported: () => true,
      register,
      isVaultUnlocked: () => false,
    });

    const first = status.start();
    const second = status.start();

    pending.resolve(idleRegistration());
    await Promise.all([first, second]);

    expect(register).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers, isolates a faulty listener and stops after unsubscribing', async () => {
    let callbacks: SwCallbacks | undefined;
    const status = createSwStatus({
      isSupported: () => true,
      register: async (received) => {
        callbacks = received;
        return idleRegistration();
      },
      isVaultUnlocked: () => false,
    });

    await status.start();

    const faulty = vi.fn(() => {
      throw new Error('listener failed');
    });
    const listener = vi.fn();
    const unsubscribeFaulty = status.subscribe(faulty);
    const unsubscribe = status.subscribe(listener);

    callbacks?.onNeedRefresh();

    expect(faulty).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    callbacks?.onError(new Error('boom'));

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribeFaulty();
  });
});
