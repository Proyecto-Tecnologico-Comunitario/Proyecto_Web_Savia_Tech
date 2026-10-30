// SPDX-License-Identifier: GPL-3.0-or-later

/** Opciones del temporizador de bloqueo automático. */
export interface AutoLockOptions {
  /** Indica si la bóveda está desbloqueada; si no, el temporizador no debe disparar. */
  readonly isUnlocked: () => boolean;
  /** Bloquea la bóveda. */
  readonly lock: () => void;
  /** Plazo vigente en milisegundos; se lee en cada actividad para respetar cambios de ajustes. */
  readonly getTimeoutMs: () => number;
  /** Documento donde se escuchan las interacciones. */
  readonly documentEvents: EventTarget;
  /** Ventana donde se escucha `pagehide`. */
  readonly windowEvents: EventTarget;
  /** Indica si la pestaña está oculta. */
  readonly isHidden: () => boolean;
  /** Reloj inyectable para pruebas. */
  readonly now?: () => number;
  /** Programador inyectable para pruebas. */
  readonly setTimer?: (callback: () => void, delayMs: number) => unknown;
  /** Cancelador inyectable para pruebas. */
  readonly clearTimer?: (handle: unknown) => void;
}

/** Control del temporizador de bloqueo automático. */
export interface AutoLock {
  /** Detiene el temporizador y retira los listeners; es idempotente. */
  stop(): void;
  /** Registra actividad explícita (por ejemplo, tras una navegación programática). */
  notifyActivity(): void;
}

/** Eventos que cuentan como actividad del usuario. */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;

/** Programa un temporizador con la API global. */
function defaultSetTimer(callback: () => void, delayMs: number): unknown {
  return globalThis.setTimeout(callback, delayMs);
}

/** Cancela un temporizador programado con la API global. */
function defaultClearTimer(handle: unknown): void {
  globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
}

/**
 * Arranca el bloqueo automático.
 *
 * El plazo se mide desde la última actividad. Al volver a la pestaña se comprueba el tiempo
 * transcurrido, porque los navegadores pueden retrasar los temporizadores en segundo plano.
 */
export function startAutoLock(options: AutoLockOptions): AutoLock {
  // Reloj y programador inyectables; en producción son los globales.
  const now = options.now ?? Date.now;
  const setTimer = options.setTimer ?? defaultSetTimer;
  const clearTimer = options.clearTimer ?? defaultClearTimer;

  // Última actividad conocida y temporizador pendiente.
  let lastActivityAt = now();
  let timer: unknown = null;
  let stopped = false;

  /** Cancela el temporizador pendiente, si lo hay. */
  function cancelTimer(): void {
    if (timer === null) {
      return;
    }

    clearTimer(timer);
    timer = null;
  }

  /** Programa la siguiente comprobación. */
  function schedule(delayMs: number): void {
    cancelTimer();

    if (stopped) {
      return;
    }

    timer = setTimer(check, Math.max(0, delayMs));
  }

  /** Comprueba el tiempo transcurrido y bloquea si se agotó. */
  function check(): void {
    // El temporizador ya se consumió.
    timer = null;

    // Un temporizador tardío no debe bloquear una bóveda que ya no está desbloqueada.
    if (stopped || !options.isUnlocked()) {
      return;
    }

    const timeoutMs = options.getTimeoutMs();
    const elapsedMs = now() - lastActivityAt;

    // Si el plazo ya venció (temporizador retrasado), se bloquea sin reprogramar.
    if (elapsedMs >= timeoutMs) {
      cancelTimer();
      options.lock();
      return;
    }

    // Si aún queda tiempo, se reprograma por el resto.
    schedule(timeoutMs - elapsedMs);
  }

  /** Registra actividad y reinicia el plazo. */
  function onActivity(): void {
    // Sin bóveda desbloqueada no hay nada que reiniciar.
    if (stopped || !options.isUnlocked()) {
      return;
    }

    lastActivityAt = now();
    schedule(options.getTimeoutMs());
  }

  /** Bloquea al ocultar la pestaña y comprueba el plazo al volver. */
  function onVisibilityChange(): void {
    if (stopped) {
      return;
    }

    // Ocultar la pestaña bloquea de inmediato: el teléfono puede guardarse sin más eventos.
    if (options.isHidden()) {
      if (options.isUnlocked()) {
        cancelTimer();
        options.lock();
      }
      return;
    }

    // Al volver, el temporizador puede haberse retrasado; se comprueba el tiempo real.
    if (!options.isUnlocked()) {
      return;
    }

    const timeoutMs = options.getTimeoutMs();
    const elapsedMs = now() - lastActivityAt;

    if (elapsedMs >= timeoutMs) {
      cancelTimer();
      options.lock();
      return;
    }

    schedule(timeoutMs - elapsedMs);
  }

  /** Bloquea al descargar o cerrar la página. */
  function onPageHide(): void {
    if (stopped || !options.isUnlocked()) {
      return;
    }

    cancelTimer();
    options.lock();
  }

  // Se registran los listeners de actividad en el documento.
  for (const type of ACTIVITY_EVENTS) {
    options.documentEvents.addEventListener(type, onActivity);
  }

  // La visibilidad y el cierre de página viven en el documento y la ventana respectivamente.
  options.documentEvents.addEventListener('visibilitychange', onVisibilityChange);
  options.windowEvents.addEventListener('pagehide', onPageHide);

  // Si ya hay una bóveda desbloqueada, se arranca el plazo.
  if (options.isUnlocked()) {
    schedule(options.getTimeoutMs());
  }

  return {
    stop() {
      if (stopped) {
        return;
      }

      stopped = true;
      cancelTimer();

      // Se retiran todos los listeners para no dejar closures vivos.
      for (const type of ACTIVITY_EVENTS) {
        options.documentEvents.removeEventListener(type, onActivity);
      }
      options.documentEvents.removeEventListener('visibilitychange', onVisibilityChange);
      options.windowEvents.removeEventListener('pagehide', onPageHide);
    },

    notifyActivity() {
      if (stopped) {
        return;
      }

      lastActivityAt = now();

      if (options.isUnlocked()) {
        schedule(options.getTimeoutMs());
      } else {
        cancelTimer();
      }
    },
  };
}
