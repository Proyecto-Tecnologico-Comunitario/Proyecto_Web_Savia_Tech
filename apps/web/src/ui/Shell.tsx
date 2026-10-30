// SPDX-License-Identifier: GPL-3.0-or-later

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useApp } from '../app/AppContext';
import { HOME_ROUTE, SETTINGS_ROUTE } from '../router/routes';
import { startAutoLock, type AutoLock } from '../session/autoLock';
import { requestPersistentStorage, type PersistenceStatus } from '../storage';
import { Header } from './components/Header';
import { FatalErrorScreen } from './screens/FatalErrorScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NeutralScreen } from './screens/NeutralScreen';
import { PinSetupScreen } from './screens/PinSetupScreen';
import { PinUnlockScreen } from './screens/PinUnlockScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StartupScreen } from './screens/StartupScreen';

/** Nombre de la app para el título del documento; se puede configurar en el despliegue. */
const APP_NAME = import.meta.env.VITE_APP_NAME ?? 'SaviaTech';

/**
 * Compuerta de acceso y composición de pantallas.
 *
 * El orden de evaluación es deliberado: la pantalla neutral gana incluso durante la carga, y ninguna
 * pantalla protegida se monta mientras la bóveda no esté desbloqueada.
 */
export function Shell() {
  const app = useApp();
  const vaultSnapshot = useSyncExternalStore(app.vault.subscribe, app.vault.getSnapshot);
  const routerSnapshot = useSyncExternalStore(app.router.subscribe, app.router.getSnapshot);

  // La instancia del auto-lock se guarda para poder reiniciarla al cambiar el plazo.
  const autoLockRef = useRef<AutoLock | null>(null);

  // Estado de la persistencia solicitada tras un desbloqueo correcto.
  const [persistence, setPersistence] = useState<PersistenceStatus | null>(null);

  // La carga inicial se lanza una vez al montar; `start()` es seguro si se repite.
  useEffect(() => {
    void app.vault.start();
  }, [app.vault]);

  // El auto-lock se monta con el documento y la ventana reales y se retira al desmontar.
  useEffect(() => {
    const autoLock = startAutoLock({
      isUnlocked: () => app.vault.getSnapshot().state === 'unlocked',
      lock: () => {
        app.vault.lock();
        app.router.reset();
      },
      getTimeoutMs: () => app.settings.load().autoLockMs,
      documentEvents: document,
      windowEvents: window,
      isHidden: () => document.hidden,
    });

    autoLockRef.current = autoLock;

    return () => {
      autoLock.stop();
      autoLockRef.current = null;
    };
  }, [app]);

  // Al desbloquear se inicia el plazo desde ese momento, no desde el montaje de la app.
  useEffect(() => {
    if (vaultSnapshot.state === 'unlocked') {
      autoLockRef.current?.notifyActivity();
    }
  }, [vaultSnapshot.state, vaultSnapshot.epoch]);

  // La persistencia se pide solo después de crear o desbloquear la bóveda, nunca al importar.
  useEffect(() => {
    if (vaultSnapshot.state !== 'unlocked') {
      return;
    }

    let active = true;

    void requestPersistentStorage().then((status) => {
      if (active) {
        setPersistence(status);
      }
    });

    return () => {
      active = false;
    };
  }, [vaultSnapshot.state, vaultSnapshot.epoch]);

  // El título vuelve al nombre de la app al salir de la pantalla neutral.
  useEffect(() => {
    if (routerSnapshot.view === 'neutral') {
      return;
    }

    document.title = APP_NAME;
  }, [routerSnapshot.view]);

  /** Bloquea la bóveda y reinicia la navegación. */
  const lockSession = useCallback(() => {
    app.vault.lock();
    app.router.reset();
  }, [app]);

  /** Abre Ajustes. */
  const openSettings = useCallback(() => {
    app.router.navigate(SETTINGS_ROUTE);
  }, [app.router]);

  /** Vuelve al inicio o a la pantalla anterior. */
  const goBack = useCallback(() => {
    if (app.router.getSnapshot().canGoBack) {
      app.router.back();
    } else {
      app.router.navigate(HOME_ROUTE);
    }
  }, [app.router]);

  /** Guarda el nuevo plazo y reinicia la cuenta del auto-lock. */
  const changeAutoLock = useCallback(
    (ms: number) => {
      app.settings.saveAutoLockMs(ms);
      autoLockRef.current?.notifyActivity();
    },
    [app.settings],
  );

  // 1. La pantalla neutral tiene prioridad sobre cualquier estado de la bóveda.
  if (routerSnapshot.view === 'neutral') {
    return <NeutralScreen onOpen={() => app.router.leaveNeutral()} />;
  }

  // 2. Mientras se lee el estado persistido no se muestra ningún formulario.
  if (vaultSnapshot.state === 'loading') {
    return <StartupScreen />;
  }

  // 3. Un fallo de carga solo ofrece reintentar; nunca borrar datos.
  if (vaultSnapshot.state === 'failed') {
    return (
      <FatalErrorScreen
        failure={vaultSnapshot.failure}
        onRetry={() => {
          void app.vault.start();
        }}
      />
    );
  }

  // 4. Sin bóveda se ofrece crearla.
  if (vaultSnapshot.state === 'uninitialized') {
    return <PinSetupScreen vault={app.vault} onQuickExit={app.quickExit} />;
  }

  // 5. Con bóveda pero sin clave se pide el PIN.
  if (vaultSnapshot.state === 'locked') {
    return <PinUnlockScreen vault={app.vault} onQuickExit={app.quickExit} />;
  }

  // 6. Solo aquí se monta el árbol protegido; la `key` descarta su estado tras cada bloqueo.
  return (
    <div key={vaultSnapshot.epoch}>
      <Header
        onLock={lockSession}
        onQuickExit={app.quickExit}
        onSettings={openSettings}
        showSettings={routerSnapshot.route.name !== 'settings'}
      />
      {routerSnapshot.route.name === 'home' ? (
        <HomeScreen persistence={persistence} />
      ) : (
        <SettingsScreen
          settings={app.settings}
          persistence={persistence}
          onAutoLockChange={changeAutoLock}
          onBack={goBack}
        />
      )}
    </div>
  );
}
