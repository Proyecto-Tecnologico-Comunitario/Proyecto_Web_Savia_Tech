// SPDX-License-Identifier: GPL-3.0-or-later

import { createKeyring, type Keyring } from '../crypto/keyring';
import { detectLocale, translate } from '../i18n';
import { createRouter, type Router } from '../router/router';
import { createQuickExit } from '../session/quickExit';
import { createVaultController, type VaultController } from '../session/vaultController';
import { createVolatileStateRegistry, type VolatileStateRegistry } from '../session/volatileState';
import { createSettingsStore, type SettingsStore } from '../settings/settingsStore';
import {
  createCaseRepository,
  cryptoMetadataStore,
  saviaDatabase,
  type CaseRepository,
} from '../storage';

/** Dependencias que la interfaz recibe de la raíz de composición. */
export interface AppDependencies {
  readonly keyring: Keyring;
  readonly repository: CaseRepository;
  readonly vault: VaultController;
  readonly router: Router;
  readonly volatileState: VolatileStateRegistry;
  readonly settings: SettingsStore;
  readonly quickExit: () => void;
}

/**
 * Crea la raíz de composición.
 *
 * Se llama una sola vez desde `main.tsx`. No hay efectos al importar: el llavero, el repositorio y los
 * controladores se construyen aquí y la UI decide cuándo arrancar la carga o pedir persistencia.
 */
export function createApp(): AppDependencies {
  // Los ajustes no sensibles se leen antes de desbloquear para que el PIN ya salga en el idioma elegido.
  const settings = createSettingsStore();

  // Se reutilizan el almacén de metadatos y la base ya existentes; no se crean singletons nuevos.
  const keyring = createKeyring({ store: cryptoMetadataStore });
  const repository = createCaseRepository({ db: saviaDatabase, keyring });

  // El registro volátil empieza vacío; T6 registrará el caso en curso.
  const volatileState = createVolatileStateRegistry();
  const vault = createVaultController({ keyring, volatileState });
  const router = createRouter();

  // La salida rápida es síncrona: bloquea, muestra Notas, reemplaza el historial y cambia el título.
  const quickExit = createQuickExit({
    lock: () => {
      vault.lock();
    },
    showNeutral: () => {
      router.showNeutral();
    },
    replaceHistory: () => {
      globalThis.history.replaceState(null, '', globalThis.location.pathname);
    },
    setTitle: () => {
      // El título neutral sigue el idioma guardado o, si no hay, el del navegador.
      const stored = settings.load().locale;
      const locale = stored ?? detectLocale(globalThis.navigator?.languages ?? []);
      document.title = translate(locale, 'neutral.title');
    },
  });

  return { keyring, repository, vault, router, volatileState, settings, quickExit };
}
