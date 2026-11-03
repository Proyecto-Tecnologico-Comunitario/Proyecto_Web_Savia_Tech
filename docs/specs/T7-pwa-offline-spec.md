# T7 — Especificación de implementación: PWA y offline

**Versión:** 0.1
**Estado:** implementada en la rama `feat/t7-pwa-offline`; T7-16 verificado y T7-20 pendiente.
**Base normativa:** `docs/specs/T7-pwa-offline-requerimiento.md` (v0.1). Si esta especificación y el requerimiento difieren, manda el requerimiento y la diferencia se anota aquí y en el ADR-0008.
**Rama:** `feat/t7-pwa-offline`.
**Alcance:** solo el frontend de `proyecto-savia-tech-web`. El backend, la sincronización y cualquier servicio alojado quedan fuera y no se simulan.

---

## 0. Cómo leer esta especificación

El requerimiento T7 fija el qué y los criterios de aceptación. Este documento fija el cómo verificable:

1. el estado real del repositorio en la fecha de la línea base,
2. las decisiones D1–D12 con sus valores aprobados,
3. el diseño archivo por archivo, con interfaces y firmas,
4. la configuración exacta de Vite, TypeScript, CI y scripts,
5. la matriz de pruebas y el mapeo T7-01…T7-20,
6. el orden de ejecución con puertas de verificación.

No se implementa nada en este documento. La implementación empieza en la fase 7a, después de aprobar esta especificación.

---

## 1. Alcance

### 1.1 Incluye

- `vite-plugin-pwa` con `generateSW`, sin service worker escrito a mano.
- Manifiesto generado por una función pura y probada.
- Íconos neutrales y script de generación reproducible.
- Registro del service worker y estado de «listo sin conexión» / «actualización disponible».
- Avisos mínimos en desbloqueo y Ajustes.
- Pruebas unitarias, auditoría del build, e2e offline, instalabilidad y rendimiento informativo.
- Documentación y CI.

### 1.2 No incluye

| Fuera de T7 | Dónde va |
| --- | --- |
| Backend, sincronización, DHIS2, tablero público | TR-002 |
| Botón propio de instalación (`beforeinstallprompt`) | D8: instalación manual documentada |
| Push, notificaciones, Background Sync, Periodic Sync | Fuera de v1 |
| Cambio de CSP o cabeceras de servidor | D9: solo se documentan |
| `runtimeCaching`, caché de datos de casos | Prohibido en v1 |
| Pausar y reanudar un tamizaje | TR-002 (ADR-0007) |
| Datos de demostración y guion | T9 |
| README completo y modelo de amenazas completo | T8; aquí solo se actualiza lo que cambia T7 |

---

## 2. Línea base verificada (2026-11-02)

### 2.1 Comandos ejecutados

| Comando | Resultado real |
| --- | --- |
| `npm ci` | 159 paquetes instalados; 15 vulnerabilidades reportadas por npm (13 moderadas, 2 críticas). No son introducidas por T7 y no se corrigen en esta tarea. |
| `npm run lint` | Pasa. ESLint y `prettier --check .` sin errores. |
| `npm run typecheck` | Pasa en `@saviatech/web` y `@saviatech/rules`. |
| `npm test` | Pasa: 22 archivos y 189 pruebas en web; 3 archivos y 51 pruebas en rules. Total 240 pruebas. |
| `npm run build` | Pasa. `dist/index.html` 0,64 kB; CSS 5,85 kB; JS 403,53 kB. |
| `npm run licenses` | Pasa: 157 paquetes de terceros, todos con licencia permitida. |

### 2.2 Tamaños de la línea base

Medidos con `zlib.gzipSync(buffer, { level: 9 })`, que es el método determinista que usará `npm run budget`:

| Archivo | Bruto | Gzip nivel 9 | Límite T7 | Margen |
| --- | ---: | ---: | ---: | ---: |
| JS inicial (`dist/assets/index-*.js`) | 403.529 B | 125.037 B (~122 KB) | 250 KB (256.000 B) | ~130.963 B |
| CSS inicial (`dist/assets/index-*.css`) | 5.852 B | 1.520 B | 30 KB (30.720 B) | ~29.200 B |
| `dist/index.html` | 643 B | 390 B | 4 KB (4.096 B) | ~3.453 B |
| `dist/sw.js` | no existe | — | 40 KB (40.960 B) | se mide en 7a |
| Precaché total | no existe | — | 1 MiB (1.048.576 B) | se mide en 7c |

Conclusión: el baseline usa aproximadamente el 49 % del presupuesto de JS inicial. Workbox y el registro deben caber en el margen restante; se vuelve a medir después de 7a y 7b.

### 2.3 Versiones y pares verificados

| Paquete | Versión | Licencia | Requisito | Papel |
| --- | --- | --- | --- | --- |
| `vite` | 7.3.7 (instalado) | MIT | `^7.0.0` aceptado por el plugin | build |
| `vite-plugin-pwa` | 2.0.0 | MIT | Node `>=20.19.0`; Vite `^3.1`…`^8`; pares `workbox-build` y `workbox-window` `^7.4.1` | `devDependencies` |
| `workbox-build` | 7.4.1 | MIT | Node `>=20.0.0` | `devDependencies` |
| `workbox-window` | 7.4.1 | MIT | dependencia de `workbox-build` y del registro | `dependencies` |
| `caniuse-lite` | 1.0.30001820 (última al verificar) | CC-BY-4.0 | dato de build, no entra al bundle | excepción D10 |
| `@playwright/test` | 1.64.1 (instalado) | Apache-2.0 | Chromium para e2e e íconos | `devDependencies` |
| Node local | v24.19.0 | — | CI y `.nvmrc`: Node 20 | validar `npm ci` en Node 20 |

`vite-plugin-pwa@2.0.0` declara `@vite-pwa/assets-generator` como par **opcional**; no se instala.

### 2.4 Opciones y APIs confirmadas en los artefactos

Confirmado leyendo los paquetes publicados (`npm pack`), no por suposición:

- `VitePWAOptions`: `strategies`, `registerType`, `injectRegister`, `manifest`, `workbox`, `devOptions`, `filename`, `manifestFilename`, `scope`.
- `GenerateSWOptions`: `globPatterns`, `globIgnores`, `navigateFallback`, `cleanupOutdatedCaches`, `skipWaiting`, `clientsClaim`, `runtimeCaching`, `inlineWorkboxRuntime`, `sourcemap`, `mode`, `importScripts`.
- `virtual:pwa-register` exporta `registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>`.
- `RegisterSWOptions` incluye `immediate`, `onNeedRefresh`, `onOfflineReady`, `onRegisteredSW`, `onRegisterError`. La librería tipa `onRegisterError` como `any`; nuestra envoltura lo recibe como `unknown` y nunca lo registra en consola.
- En `registerType: 'prompt'`, el valor devuelto por `registerSW` llama a `messageSkipWaiting()`; la recarga ocurre cuando el nuevo service worker toma el control (`controlling`) y la librería ejecuta `window.location.reload()`. El parámetro `reloadPage` ya no se usa en la versión 2.0.0.
- `skipWaiting: false` hace que Workbox añada el listener de mensaje `SKIP_WAITING`; no hay `skipWaiting` automático.
- Playwright 1.64.1 expone `context.setOffline(boolean)`, `context.newCDPSession(page)` y el envío de comandos CDP (`Page.getInstallabilityErrors`, `Page.getAppManifest`, `Emulation.setCPUThrottlingRate`, `Network.emulateNetworkConditions`) mediante `session.send`.

### 2.5 Puntos de integración en el código actual

| Archivo | Estado actual | Cambio T7 |
| --- | --- | --- |
| `apps/web/vite.config.ts:1` | Solo `build.target` y `test.include`. | Plugin PWA, `base`, `loadEnv`, manifiesto. |
| `apps/web/index.html:1` | Sin manifest, icon, apple-touch-icon ni theme-color. CSP estricta. | Metadatos nuevos; CSP intacta. El `<link rel="manifest">` lo inyecta el plugin. |
| `apps/web/src/main.tsx:17` | Crea `app` y renderiza. | Crea `swStatus` y arranca el registro tras `load`. |
| `apps/web/src/App.tsx:1` | Recibe `app`. | Recibe también `swStatus`. |
| `apps/web/src/ui/Shell.tsx:30` | Título desde `VITE_APP_NAME`. | Propaga `swStatus` a desbloqueo y Ajustes. |
| `apps/web/src/ui/screens/PinUnlockScreen.tsx:1` | Formulario de PIN. | Aviso de actualización con botón. |
| `apps/web/src/ui/screens/SettingsScreen.tsx:1` | Idioma, auto-lock, almacenamiento. | Aviso sin botón e indicador «listo sin conexión». |
| `apps/web/src/crypto/keyring.ts:69` | `getState(): VaultState`. | Solo lectura para bloquear `applyUpdate()`. No se modifica. |
| `apps/web/src/styles/__tests__/indexHtml.test.ts:18` | Fija CSS y CSP. | Se amplía para iconos y theme-color. |
| `apps/web/e2e/fixtures.ts:58` | Vigila CSP, consola y red externa. | Sin cambios; las pruebas nuevas heredan la vigilancia. |
| `apps/web/playwright.config.ts:32` | Compila y sirve en `127.0.0.1:4173`. | Ignora `perf.spec.ts` salvo `PERF=1`. |
| `.github/workflows/ci.yml` | Jobs `verify` y `e2e`. | `npm run budget` tras el build en `verify`. |

---

## 3. Decisiones

| ID | Decisión | Valor aprobado |
| --- | --- | --- |
| D1 | Generación del service worker | `vite-plugin-pwa` con `strategies: 'generateSW'` y `workbox.inlineWorkboxRuntime: true`. Sin archivo de SW escrito a mano. `devOptions.enabled: false`. |
| D2 | Registro y actualización | `registerType: 'prompt'`, `injectRegister: false`, registro propio con `virtual:pwa-register`, `skipWaiting: false`, `clientsClaim: false`, `cleanupOutdatedCaches: true`. Sin sondeo periódico. |
| D3 | Precaché | Todo lo que emite el build: HTML, JS, CSS, íconos y `manifest.webmanifest`. Sin mapas de fuente. `runtimeCaching: []`. `navigateFallback: 'index.html'`. |
| D4 | Nombre, íconos y base | `VITE_APP_NAME` (por defecto `SaviaTech`), `VITE_APP_SHORT_NAME` (por defecto los primeros 12 caracteres), `VITE_BASE_PATH` (por defecto `/`). El build falla si el nombre está vacío o supera 45 caracteres. **Aprobado: base `/`.** |
| D5 | Íconos por defecto | Diseño neutral y geométrico generado desde un SVG con el Chromium de Playwright; PNG commiteados. Sin símbolos sensibles ni texto. **Aprobado: `SaviaTech` + ícono neutral.** |
| D6 | Presupuesto | `apps/web/bundle-budget.json` con los límites de §6.5 del requerimiento, verificado por `npm run budget` en CI. |
| D7 | Indicadores en la UI | «Lista para usar sin conexión» en Ajustes y aviso de actualización disponible en desbloqueo y Ajustes. Texto genérico. |
| D8 | Instalación | Sin botón propio. Se documenta la instalación manual en README. |
| D9 | Cabeceras de hosting | No se implementan; se documentan HTTPS, `Cache-Control: no-cache` para `index.html`, `sw.js` y `manifest.webmanifest`, y CSP en cabecera equivalente. |
| D10 | Licencia de `caniuse-lite` | **Aprobada** una excepción nominal en `scripts/check-licenses.mjs`, solo para `caniuse-lite`, con comentario y nota en ADR-0008. No entra al bundle. |
| D11 | Pruebas de actualización | Unitarias de `swStatus` y verificación manual documentada (T7-16). La prueba e2e con dos builds queda pendiente por costo. |
| D12 | Medición con perfil limitado | `e2e/perf.spec.ts`, solo con `PERF=1`, fuera de CI. Informativa, no sustituye la medición en teléfono real. |

---

## 4. Arquitectura

### 4.1 Build

```text
.env (VITE_APP_NAME, VITE_APP_SHORT_NAME, VITE_BASE_PATH)
        │
        ▼
vite.config.ts ── loadEnv ──► src/pwa/manifest.ts (buildManifest)
        │                              │
        │                              ▼
        │                     manifest.webmanifest
        ▼
VitePWA(generateSW) ──► dist/sw.js (runtime de Workbox embebido)
        │
        ├── precache: index.html, assets/*.js, assets/*.css, icons/*.png|svg, manifest.webmanifest
        └── sin runtimeCaching, sin fetch handlers propios
```

Invariantes del build:

1. `dist/sw.js` es un único archivo y no contiene `importScripts(`.
2. `dist/index.html` contiene exactamente un `<link rel="manifest">` (inyectado por el plugin) y ningún script o estilo en línea.
3. El precaché solo contiene URLs del mismo origen y archivos emitidos por el build.
4. El manifiesto no contiene campos prohibidos ni términos sensibles.
5. Los íconos declarados existen y sus dimensiones reales coinciden.

### 4.2 Runtime

```text
main.tsx
  ├── createApp() ──► keyring, vault, router, settings, quickExit
  ├── createSwStatus({ isSupported, register, isVaultUnlocked })
  └── render(<App app swStatus />)
        │
        ├── Shell ──► PinUnlockScreen (UpdateNotice con botón)
        │        └── SettingsScreen (UpdateNotice sin botón + OfflineReadyStatus)
        │
        └── window.load ──► swStatus.start()
                              │
                              └── registerServiceWorker(callbacks)
                                    │ (solo PROD y serviceWorker disponible)
                                    └── import('virtual:pwa-register')
                                          └── registerSW({ immediate: false, ... })
```

`swStatus` no toca el DOM. Recibe `isSupported`, `register` e `isVaultUnlocked` por inyección; así se prueba en Node sin navegador.

### 4.3 Actualización

1. El navegador detecta un `sw.js` nuevo en una navegación normal; no hay sondeo periódico.
2. El nuevo SW queda en `waiting`; `registerSW` llama a `onNeedRefresh`.
3. `swStatus` pasa a `updateAvailable`. La UI muestra el aviso.
4. En desbloqueo, el botón «Actualizar» llama a `applyUpdate()`.
5. `applyUpdate()` comprueba `isVaultUnlocked()`:
   - si la bóveda está desbloqueada, devuelve `blocked` y no hace nada;
   - si está bloqueada, llama a `update(true)`, que envía `SKIP_WAITING`; al tomar el control, la librería recarga la página.
6. En Ajustes no hay botón: el texto «Se aplicará al bloquear» explica la regla. La persona bloquea y actualiza desde la pantalla de PIN.

No hay `skipWaiting` automático, ni recarga automática, ni pérdida de trabajo en curso.

### 4.4 Invariantes de seguridad

- La caché solo contiene el cascarón del build; nunca datos de casos, PIN, respuestas ni justificaciones.
- No se escribe en `localStorage` nada nuevo; la única clave sigue siendo `saviatech.settings`.
- `sessionStorage` permanece vacío.
- No se modifica `apps/web/src/crypto/`, PBKDF2, auto-lock ni salida rápida.
- No se modifica la CSP.
- No hay peticiones a otros orígenes; el fixture e2e lo verifica.

---

## 5. Diseño por archivo

### 5.1 `apps/web/src/pwa/manifest.ts`

Función pura, sin DOM, sin I/O y sin dependencias de React. La importa `vite.config.ts` y la prueban las unitarias.

```ts
// SPDX-License-Identifier: GPL-3.0-or-later

export const APP_NAME_MAX_LENGTH = 45;
export const SHORT_NAME_FALLBACK_LENGTH = 12;
export const DEFAULT_BASE_PATH = '/';
export const MANIFEST_THEME_COLOR = '#ffffff';
export const MANIFEST_BACKGROUND_COLOR = '#ffffff';

export interface ManifestInput {
  readonly name: string;
  readonly shortName?: string;
  readonly base?: string;
}

export interface ManifestIcon {
  readonly src: string;
  readonly sizes: string;
  readonly type: 'image/png';
  readonly purpose?: 'any' | 'maskable';
}

export interface WebAppManifest {
  readonly name: string;
  readonly short_name: string;
  readonly id: string;
  readonly start_url: string;
  readonly scope: string;
  readonly display: 'standalone';
  readonly lang: 'es';
  readonly background_color: string;
  readonly theme_color: string;
  readonly icons: ManifestIcon[];
}

export function normaliseBasePath(raw: string | undefined): string {
  // ...
}

export function buildManifest(input: ManifestInput): WebAppManifest {
  // ...
}
```

Reglas:

- `name` se recorta; vacío o longitud > 45 lanza `Error` con mensaje en inglés. El build falla.
- `shortName` se recorta; si falta o queda vacío, se usan los primeros 12 caracteres de `name`. Un valor propio debe tener entre 1 y 45 caracteres.
- `base` se normaliza: `undefined` o vacío → `/`; debe empezar por `/`, terminar en `/`, y no contener `//`, `..`, `\`, `?`, `#` ni espacios. Un valor inválido lanza `Error`.
- `id`, `start_url` y `scope` son exactamente la base normalizada.
- `display: 'standalone'`, `lang: 'es'`.
- `background_color` y `theme_color` usan `--color-bg` del modo claro: `#ffffff`.
- Íconos, relativos a la base:
  - `${base}icons/icon-192.png`, 192×192, `purpose: 'any'`.
  - `${base}icons/icon-512.png`, 512×512, `purpose: 'any'`.
  - `${base}icons/icon-maskable-512.png`, 512×512, `purpose: 'maskable'`.
- El objeto final no incluye `description`, `categories`, `shortcuts`, `screenshots`, `share_target`, `file_handlers`, `protocol_handlers`, `related_applications` ni `orientation`.
- Se valida que ningún valor de texto contenga términos sensibles (comparación sin mayúsculas ni acentos): `violencia`, `violence`, `mujer`, `woman`, `women`, `riesgo`, `risk`, `tamizaje`, `screening`, `salud mental`, `mental health`. Si aparece uno, el build falla.

Pruebas unitarias (`src/pwa/__tests__/manifest.test.ts`):

1. Valores por defecto con `SaviaTech` y base `/`.
2. Nombre y nombre corto personalizados.
3. Base con subruta (`/savia/`) en `id`, `start_url`, `scope` e íconos.
4. Base inválida (`savia`, `/savia`, `/../`, `//`, con `?`) lanza.
5. Nombre vacío lanza; nombre de 46 caracteres lanza; 45 se acepta.
6. `short_name` por defecto son los primeros 12 caracteres.
7. Ausencia de todos los campos prohibidos.
8. Ausencia de términos sensibles en el manifiesto por defecto.
9. Un nombre con término sensible lanza.
10. Los íconos declarados son los tres esperados y sus rutas respetan la base.

### 5.2 `apps/web/src/pwa/swStatus.ts`

Estado observable, sin DOM, con el patrón `createX(deps)` del repositorio.

```ts
// SPDX-License-Identifier: GPL-3.0-or-later

export type ServiceWorkerStatus =
  | 'unsupported'
  | 'registering'
  | 'offlineReady'
  | 'updateAvailable'
  | 'error';

export type ApplyUpdateResult = 'applied' | 'blocked' | 'unavailable';

export interface SwCallbacks {
  readonly onOfflineReady: () => void;
  readonly onNeedRefresh: () => void;
  readonly onRegistered: () => void;
  readonly onError: (error: unknown) => void;
}

export interface SwRegistration {
  readonly update: (reloadPage?: boolean) => Promise<void>;
}

export interface SwStatusOptions {
  readonly isSupported: () => boolean;
  readonly register: (callbacks: SwCallbacks) => Promise<SwRegistration>;
  readonly isVaultUnlocked: () => boolean;
}

export interface SwStatus {
  start(): Promise<void>;
  getState(): ServiceWorkerStatus;
  subscribe(listener: () => void): () => void;
  applyUpdate(): Promise<ApplyUpdateResult>;
}

export function createSwStatus(options: SwStatusOptions): SwStatus {
  // ...
}
```

Comportamiento:

| Situación | Estado |
| --- | --- |
| `isSupported()` falso | `unsupported` |
| Antes de `start()`, con soporte | `registering` |
| `register()` resuelve y no hay actualización | `offlineReady` |
| `onOfflineReady()` | `offlineReady` |
| `onNeedRefresh()` | `updateAvailable` |
| `register()` lanza o `onError()` | `error` |

Reglas:

- `start()` es idempotente; una segunda llamada no registra dos veces.
- `subscribe()` devuelve una función para cancelar; un suscriptor defectuoso no impide notificar a los demás.
- `applyUpdate()`:
  - si el estado no es `updateAvailable` o no hay registro → `unavailable`;
  - si `isVaultUnlocked()` → `blocked`, sin llamar a `update()`;
  - si la bóveda está bloqueada → `await registration.update(true)` y devuelve `applied`;
  - si `update()` lanza → estado `error` y devuelve `unavailable`.
- No usa `console`, `localStorage`, `sessionStorage`, `document` ni `window`.
- No muestra ni propaga `error.message`.

Pruebas unitarias (`src/pwa/__tests__/swStatus.test.ts`):

1. Sin soporte → `unsupported` y no registra.
2. `start()` → `registering`; `onRegistered()` → `offlineReady`.
3. `onOfflineReady()` → `offlineReady`.
4. `onNeedRefresh()` → `updateAvailable`.
5. `register()` rechaza → `error`.
6. `onError()` → `error`.
7. `applyUpdate()` sin actualización → `unavailable`.
8. `applyUpdate()` con bóveda desbloqueada → `blocked` y `update` no se llama.
9. `applyUpdate()` con bóveda bloqueada → `applied` y `update(true)` se llama una vez.
10. `update()` rechaza → `error` y `unavailable`.
11. `start()` dos veces registra una sola vez.
12. `subscribe()` notifica y la cancelación detiene las notificaciones.

### 5.3 `apps/web/src/pwa/registerServiceWorker.ts`

Envoltura delgada de `virtual:pwa-register`. No hay efectos al importar.

```ts
// SPDX-License-Identifier: GPL-3.0-or-later

import type { SwCallbacks, SwRegistration } from './swStatus';

export async function registerServiceWorker(callbacks: SwCallbacks): Promise<SwRegistration> {
  // En desarrollo y en pruebas no se registra nada; el SW se verifica con build + preview.
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return { update: async () => undefined };
  }

  // Import dinámico: el módulo virtual solo se evalúa cuando de verdad se registra.
  const { registerSW } = await import('virtual:pwa-register');

  const update = registerSW({
    immediate: false,
    onOfflineReady: callbacks.onOfflineReady,
    onNeedRefresh: callbacks.onNeedRefresh,
    onRegisteredSW: () => callbacks.onRegistered(),
    onRegisterError: (error: unknown) => callbacks.onError(error),
  });

  return { update };
}
```

Notas:

- `registerSW` devuelve la función de actualización; no recarga por sí sola hasta que el nuevo SW toma el control.
- El `import()` dinámico crea un chunk propio (incluye `workbox-window`). Ese chunk se precachea y se sirve desde la caché en frío.
- `onRegisterError` se recibe como `unknown`; nunca se imprime ni se muestra.

### 5.4 `main.tsx`, `App.tsx` y `Shell.tsx`

`main.tsx`:

```tsx
const app = createApp();

const swStatus = createSwStatus({
  isSupported: () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  register: registerServiceWorker,
  isVaultUnlocked: () => app.keyring.getState() === 'unlocked',
});

createRoot(rootElement).render(
  <StrictMode>
    <App app={app} swStatus={swStatus} />
  </StrictMode>,
);

// El registro no compite con el arranque de React.
const startServiceWorker = (): void => {
  void swStatus.start();
};

if (document.readyState === 'complete') {
  startServiceWorker();
} else {
  window.addEventListener('load', startServiceWorker, { once: true });
}
```

`App.tsx` recibe `swStatus` y lo pasa a `Shell`. `Shell.tsx` lo pasa a `PinUnlockScreen` y `SettingsScreen`. No se crea un contexto nuevo: dos props explícitas son suficientes y mantienen el flujo visible.

### 5.5 `UpdateNotice.tsx` y `OfflineReadyStatus.tsx`

`UpdateNotice` es presentacional:

```tsx
interface UpdateNoticeProps {
  readonly state: ServiceWorkerStatus;
  readonly variant: 'unlock' | 'settings';
  readonly onApply?: () => void;
}
```

- Solo se renderiza con `state === 'updateAvailable'`.
- `variant === 'unlock'`: `<section className="pwa-notice" role="status">`, título y botón «Actualizar» (`button button-primary`) que llama a `onApply`.
- `variant === 'settings'`: mismo título y texto «Se aplicará al bloquear», sin botón.
- Usa `useI18n`; no usa `style=` ni texto hardcodeado.
- El botón hereda `min-height: var(--tap-target)` de `.button` (`apps/web/src/styles/components.css:3`), por lo que cumple 44 px.

`OfflineReadyStatus`:

- `offlineReady` → «Lista para usar sin conexión».
- `error` o `unsupported` → «Sin modo sin conexión».
- `registering` o `updateAvailable` → no renderiza nada (el aviso de actualización cubre el segundo caso).

En `PinUnlockScreen` el aviso va antes del formulario, dentro de `<main>`. En `SettingsScreen` se añade una sección «Aplicación» con el aviso y el indicador, después de la sección de almacenamiento.

### 5.6 i18n

Se añaden exactamente las mismas claves en `es.json` y `en.json`:

| Clave | Español | Inglés |
| --- | --- | --- |
| `pwa.section` | Aplicación | App |
| `pwa.update.title` | Actualización disponible | Update available |
| `pwa.update.apply` | Actualizar | Update |
| `pwa.update.onLock` | Se aplicará al bloquear | It will be applied when you lock |
| `pwa.offlineReady` | Lista para usar sin conexión | Ready to use offline |
| `pwa.offlineUnavailable` | Sin modo sin conexión | Offline mode unavailable |

La prueba de paridad de `i18n.test.ts` debe seguir pasando sin cambios.

### 5.7 `apps/web/vite.config.ts`

```ts
// SPDX-License-Identifier: GPL-3.0-or-later

import { fileURLToPath, URL } from 'node:url';

import { loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

import { buildManifest, normaliseBasePath } from './src/pwa/manifest';

export default defineConfig(({ mode }) => {
  const appRoot = fileURLToPath(new URL('.', import.meta.url));
  const env = loadEnv(mode, appRoot, 'VITE_');
  const base = normaliseBasePath(env.VITE_BASE_PATH);
  const name = env.VITE_APP_NAME ?? 'SaviaTech';
  const shortName = env.VITE_APP_SHORT_NAME;

  return {
    base,
    build: {
      target: 'es2022',
      sourcemap: false,
    },
    plugins: [
      VitePWA({
        strategies: 'generateSW',
        registerType: 'prompt',
        injectRegister: false,
        manifest: buildManifest({ name, shortName, base }),
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
          globIgnores: ['**/*.map'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          skipWaiting: false,
          clientsClaim: false,
          runtimeCaching: [],
          inlineWorkboxRuntime: true,
          sourcemap: false,
        },
        devOptions: { enabled: false },
      }),
    ],
    test: {
      include: ['src/**/*.test.ts'],
    },
  };
});
```

Verificaciones tras compilar:

- `dist/sw.js` existe, es un único archivo y no contiene `importScripts(`.
- `dist/manifest.webmanifest` existe y coincide con `buildManifest`.
- `dist/index.html` tiene exactamente un `<link rel="manifest">`; el plugin lo inyecta, no se escribe a mano.
- La lista de precaché no incluye `sw.js` ni URLs absolutas.
- Si `sw.js` supera 40 KB, no se sube el límite en silencio: se mide, se anota en ADR-0008 y se pide decisión.

### 5.8 `apps/web/index.html`

Se añaden, sin tocar la CSP:

```html
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<meta name="theme-color" content="#ffffff" />
<meta name="theme-color" content="#121212" media="(prefers-color-scheme: dark)" />
```

No se añade `<link rel="manifest">`: lo inyecta `vite-plugin-pwa`. Si se añadiera a mano, habría dos y la auditoría fallaría.

`indexHtml.test.ts` se amplía para comprobar:

1. Los tres CSS siguen en el mismo orden.
2. La CSP no contiene `'unsafe-inline'`.
3. Existe un `<link rel="icon">` con `/icons/icon.svg`.
4. Existe un `<link rel="apple-touch-icon">` con `/icons/apple-touch-icon.png`.
5. Existen dos `<meta name="theme-color">`: uno claro `#ffffff` y uno oscuro `#121212` con `prefers-color-scheme: dark`.
6. No hay `<script>` sin `src`, ni `<style>`, ni `style=` en el HTML fuente.

### 5.9 `apps/web/src/vite-env.d.ts` y `tsconfig.json`

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
// SPDX-License-Identifier: GPL-3.0-or-later

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_SHORT_NAME?: string;
  readonly VITE_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

No hace falta cambiar `tsconfig.json`: ya incluye `src`, `e2e`, `vite.config.ts` y `playwright.config.ts`. Si la referencia de tipos no resolviera, la alternativa mínima es añadir `"vite-plugin-pwa/client"` a `compilerOptions.types`; se anota en el ADR si ocurre.

### 5.10 `scripts/generate-icons.mjs`

Script de desarrollo, no se ejecuta en CI.

- Lee `apps/web/public/icons/icon.svg`.
- Lanza Chromium con `chromium.launch()` de `@playwright/test`.
- Genera, con `page.screenshot({ omitBackground: false })`:
  - `icon-192.png` (192×192),
  - `icon-512.png` (512×512),
  - `icon-maskable-512.png` (512×512, con zona segura del 80 %),
  - `apple-touch-icon.png` (180×180).
- Escribe en `apps/web/public/icons/`.
- Si Chromium no está instalado, falla con un mensaje que indique `npm run e2e:install`.
- Los PNG se commitean; el script existe para reproducirlos.
- El SVG es geométrico y neutral: cuadrado redondeado con un glifo simple tipo bloc de notas; sin corazones, escudos, siluetas, símbolos de ayuda ni el nombre de la app.

### 5.11 `scripts/check-budget.mjs`

Script Node ESM, sin dependencias nuevas. Cabecera SPDX MIT.

Entradas:

- `apps/web/dist/index.html`
- `apps/web/dist/sw.js`
- `apps/web/dist/manifest.webmanifest`
- `apps/web/dist/icons/*`
- `apps/web/bundle-budget.json`

Medición:

1. Lee `index.html` y extrae los `src` de `<script>` y los `href` de `<link rel="modulepreload">`. Suma el gzip nivel 9 de cada archivo único; ese es el JS inicial.
2. Extrae los `href` de `<link rel="stylesheet">` y suma su gzip nivel 9.
3. Mide `index.html` sin comprimir.
4. Mide `sw.js` sin comprimir.
5. Parsea el manifiesto de precaché embebido en `sw.js` (la llamada `precacheAndRoute([...])`). Si el formato no se puede parsear, falla con un mensaje claro. Suma el tamaño bruto de las entradas.
6. Compara con `bundle-budget.json`; usa 1 KB = 1024 B.

Auditoría (falla con código distinto de cero):

- Falta `sw.js`, `manifest.webmanifest` o algún ícono declarado.
- `index.html` no tiene exactamente un `<link rel="manifest">`.
- `index.html` tiene `<script>` sin `src`, `<style>` o `style=`.
- La CSP cambió o contiene `'unsafe-inline'`.
- `sw.js` contiene `http://` o `https://` fuera de una lista permitida comentada; contiene `importScripts(`.
- El precaché incluye `sw.js`, una URL con otro origen o un archivo que no existe en `dist/`.
- El manifiesto incluye campos prohibidos o términos sensibles.
- Un ícono declarado no es PNG, no existe o sus dimensiones reales no coinciden con `sizes`.

Salida:

```text
Metric                    Actual        Limit      Margin    Status
JS initial (gzip)         125.037 B     256.000 B  130.963 B  ok
CSS initial (gzip)          1.520 B      30.720 B   29.200 B  ok
index.html                    643 B       4.096 B    3.453 B  ok
sw.js                         ... B      40.960 B      ... B  ok
precache total                ... B   1.048.576 B      ... B  ok
```

Un valor ≥ 80 % del límite se marca `warn`, pero no falla. Un valor por encima del límite se marca `fail` y el script termina con código 1.

### 5.12 `apps/web/bundle-budget.json`

```json
{
  "jsGzipBytes": 256000,
  "cssGzipBytes": 30720,
  "indexHtmlBytes": 4096,
  "serviceWorkerBytes": 40960,
  "precacheBytes": 1048576,
  "warnRatio": 0.8
}
```

Cambiar cualquier valor exige una línea en ADR-0008 y revisión humana.

### 5.13 `package.json` y CI

`apps/web/package.json`:

- `dependencies`: añadir `"workbox-window": "7.4.1"`.
- `devDependencies`: añadir `"vite-plugin-pwa": "2.0.0"` y `"workbox-build": "7.4.1"`.
- Versiones exactas, fijadas por `package-lock.json`.

`package.json` raíz:

- `"budget": "node scripts/check-budget.mjs"`.
- Opcional: `"icons": "node scripts/generate-icons.mjs"` para regenerar íconos.

`.github/workflows/ci.yml`, job `verify`, después de `Build`:

```yaml
- name: Bundle budget and build audit
  run: npm run budget
```

El job `e2e` no cambia: `playwright.config.ts` ya compila y sirve el build.

`scripts/check-licenses.mjs`:

- Añadir una excepción nominal para `caniuse-lite` con licencia `CC-BY-4.0`, solo si el nombre del paquete coincide exactamente.
- Comentario en el script: dato de build de la cadena de Workbox, no entra al bundle; aprobado como D10.
- Nota en ADR-0008.
- No se añade `CC-BY-4.0` a la lista general de licencias permitidas.

### 5.14 Pruebas e2e

#### `apps/web/e2e/caseFlowSteps.ts` (nuevo)

Extrae de `flows.spec.ts` los pasos reutilizables sin cambiar aserciones:

- `startCase(page)`: abre «Nuevo caso», marca consentimiento, continúa y espera el tamizaje.
- `answerAll(page, option)`: responde las 9 preguntas y finaliza.
- `saveScreening(page)`: guarda y espera el detalle del caso.

`flows.spec.ts` importa estos pasos y elimina sus copias locales. Las pruebas T1–T6 conservan sus aserciones.

#### `apps/web/e2e/pwa.ts` (nuevo)

Utilidades:

- `waitForServiceWorkerReady(page)`: espera `navigator.serviceWorker.ready`.
- `waitForController(page)`: usa `expect.poll` hasta que `navigator.serviceWorker.controller` no sea `null`.
- `readBuildPrecacheUrls()`: lee `apps/web/dist/sw.js` desde Node y devuelve las URLs del precaché.
- `warmOfflineCache(page)`: visita `/`, espera el SW, comprueba que la caché `workbox-precache*` contiene todas las URLs del build y recarga una vez para quedar controlado.
- `goOffline(context)`: `await context.setOffline(true)`.
- `readCacheAudit(page)`: devuelve claves de caché, URLs y textos de las respuestas.

Nunca se usa `waitForTimeout`; se usa `expect.poll` o eventos.

#### `apps/web/e2e/offline.spec.ts` (nuevo)

| Escenario | Pasos | Aserciones |
| --- | --- | --- |
| O1 Instalación del SW | `warmOfflineCache` | SW registrado, activo y controlando; el precaché contiene todos los archivos del build. |
| O2 Arranque en frío sin red | Crear bóveda en línea, bloquear, `goOffline`, `page.reload()` | Se muestra la pantalla de desbloqueo. |
| O3 Flujo completo sin red | Crear bóveda en línea, bloquear, `goOffline`, desbloquear y ejecutar el flujo con ítem de seguridad, alerta, resultado con cambio de banda y justificación, guardar, remisión, salida rápida y bloqueo | El flujo termina; no hay texto clínico en la pantalla neutral; el fixture no reporta errores. |
| O4 Primer uso sin red | `warmOfflineCache`, `goOffline`, `page.reload()`, crear PIN y bóveda | Se llega a Inicio sin red. |
| O5 Auditoría de cachés | Repetir un flujo mínimo (bóveda, caso, tamizaje, guardar) y auditar | Solo cachés `workbox-precache*`; URLs del mismo origen y del build; ninguna respuesta contiene el código del caso, el PIN, la justificación ni respuestas del usuario; `localStorage` solo tiene `saviatech.settings`; `sessionStorage` vacío. |
| O6 Sin red de terceros | Heredado del fixture | Cero violaciones de CSP, errores de consola, errores de página y peticiones externas. |

Nota sobre O5: el bundle JS contiene el instrumento de muestra y los textos de contenido; eso es contenido versionado del build, no dato de la usuaria. La auditoría busca el código del caso, el PIN, la justificación escrita y las respuestas introducidas, no las cadenas del instrumento.

Nota sobre O2: se usa una recarga completa en la misma página para conservar las vigilancias del fixture (CSP, consola y red). Una página nueva del mismo contexto equivaldría funcionalmente, pero quedaría fuera del fixture; si se prefiere, se instrumenta también la página nueva. Se anota en ADR-0008.

#### `apps/web/e2e/installability.spec.ts` (nuevo)

Solo Chromium, por CDP:

1. `const session = await context.newCDPSession(page)`.
2. `Page.getInstallabilityErrors` → lista vacía.
3. `Page.getAppManifest` → sin errores; `name`, `short_name`, `display`, `start_url`, `scope` e íconos esperados.
4. Cada ícono declarado responde 200 y empieza con la firma PNG (`89 50 4E 47`).
5. `index.html` tiene icon, apple-touch-icon y los dos theme-color.

Si el nombre o la forma de la respuesta CDP difieren en Playwright 1.64.1, se confirma en la implementación y se anota; no se debilita la aserción.

#### `apps/web/e2e/perf.spec.ts` (nuevo, solo `PERF=1`)

- `playwright.config.ts`: `testIgnore: process.env.PERF === '1' ? [] : ['**/perf.spec.ts']`.
- Mide con `Emulation.setCPUThrottlingRate` (4× y 6×) y `Network.emulateNetworkConditions` (Slow 4G).
- Dos escenarios: primera carga sin caché y carga posterior servida por el SW.
- Mide hasta ver la pantalla de PIN; excluye PBKDF2.
- Imprime la tabla con `test.info().annotations`, no con `console`.
- No bloquea CI y no sustituye la medición en un teléfono real.

### 5.15 Documentación

- `docs/adr/0008-pwa-offline.md` (inglés, corto): D1–D12, por qué solo precaché, por qué `prompt`, por qué nombre e íconos neutrales, tamaños medidos, excepción de `caniuse-lite`, pruebas no cubiertas por e2e.
- `docs/threat-model.md`: sección «Implemented PWA controls (T7)» y límites nuevos:
  - el nombre y el ícono instalados son visibles en la pantalla de inicio y en el conmutador de apps;
  - el precaché es visible en los datos del sitio del navegador y no contiene datos de casos;
  - la caché y IndexedDB pueden ser desalojadas por el sistema;
  - en iOS Safari, WebKit limita el almacenamiento de sitios usados poco; verificar la fuente vigente antes de afirmarlo y distinguir Safari de la app añadida a la pantalla de inicio;
  - la actualización requiere conexión y una acción de la persona; puede haber teléfonos con una versión antigua.
- `README.md`: instalación manual, demo sin red, reemplazo de nombre e íconos, HTTPS o `adb reverse`, cabeceras recomendadas, tabla de mediciones; quitar «The PWA offline flow is T7».
- `AGENTS.md`: añadir `npm run budget` a los comandos; añadir `apps/web/src/pwa/` al árbol; cambiar la frase de `npm run e2e` a «offline flow included».
- `docs/specs/TR-001-vertical-slice.md`: estado «T7 implemented» y «T8 next» en el encabezado y en §9.
- `SECURITY.md`: solo si cambia algo de lo declarado; el alcance ya menciona las cachés del service worker.

---

## 6. Matriz de pruebas

### 6.1 Unitarias (`npm test`)

| Archivo | Cubre |
| --- | --- |
| `src/pwa/__tests__/manifest.test.ts` | T7-04, T7-05 |
| `src/pwa/__tests__/swStatus.test.ts` | T7-14, T7-17 |
| `src/styles/__tests__/indexHtml.test.ts` | T7-03 |
| Resto de pruebas T1–T6 | Sin cambios; deben seguir pasando (T7-18) |

### 6.2 Auditoría del build (`npm run budget`)

Cubre T7-02, T7-06 y T7-13. Se ejecuta después de `npm run build`.

### 6.3 E2E (`npm run e2e`)

| Archivo | Cubre |
| --- | --- |
| `e2e/offline.spec.ts` | T7-07, T7-08, T7-09, T7-10, T7-11 |
| `e2e/installability.spec.ts` | T7-12 |
| `e2e/perf.spec.ts` | Informativo (D12) |
| Resto de pruebas T1–T6 | Sin cambios (T7-18) |

### 6.4 Verificación manual

- **T7-16, actualización:** ejecutado el 2026-11-02 en Chromium (Playwright). Se compiló v1, se sirvió en `http://127.0.0.1:4180`, se creó una bóveda y un tamizaje, se cambió un texto y se recompiló v2. Tras recargar apareció el aviso en el desbloqueo; con la bóveda desbloqueada Ajustes mostró «Se aplicará al bloquear» y ningún botón; tras bloquear y pulsar «Actualizar» se cargó la v2 y el caso siguió ahí. Sin errores de consola ni de página. Resultado registrado en el README.
- **T7-20, Android de gama baja:** pendiente; no se marca como hecho hasta registrar modelo y resultado en README.

---

## 7. Mapeo de criterios de aceptación

| ID | Evidencia |
| --- | --- |
| T7-01 | `package.json` y `package-lock.json` con las tres dependencias exactas; `npm run licenses` pasa con la excepción D10 aprobada. |
| T7-02 | `npm run build` genera `dist/sw.js` único y `dist/manifest.webmanifest`; `npm run budget` comprueba un solo `<link rel="manifest">`. |
| T7-03 | `indexHtml.test.ts` ampliado; CSP sin cambios y sin `unsafe-inline`. |
| T7-04 | Unitarias de `manifest.test.ts`: campos, base, íconos, ausencia de campos prohibidos y términos sensibles. |
| T7-05 | Unitarias de nombre vacío y de 46 caracteres; el build falla al evaluar `buildManifest`. |
| T7-06 | Auditoría de precaché y O5: solo archivos del build, sin `runtimeCaching`, sin `fetch` propios. |
| T7-07 | O1. |
| T7-08 | O2 y O3. |
| T7-09 | O4. |
| T7-10 | O5: cachés sin datos de casos ni PIN; `localStorage` solo con ajustes. |
| T7-11 | O6 y el fixture de todas las pruebas nuevas. |
| T7-12 | `installability.spec.ts` con CDP. |
| T7-13 | `npm run budget` en CI; tamaños reales y margen en ADR-0008 y en el reporte final. |
| T7-14 | Unitarias de `swStatus`: `updateAvailable`, `blocked` con bóveda desbloqueada, `applied` con bóveda bloqueada; sin `skipWaiting` ni recarga automática. |
| T7-15 | `UpdateNotice` y `OfflineReadyStatus` con i18n es/en, foco visible, 44 px, AA en claro/oscuro y sin `style=`. |
| T7-16 | Verificación manual documentada y ejecutada. |
| T7-17 | Unitaria de `swStatus` con `register()` rechazando y `onError`; la app sigue en línea. |
| T7-18 | Suite completa T1–T6; solo se amplía `indexHtml.test.ts` y se extraen pasos e2e sin cambiar aserciones. |
| T7-19 | `npm run lint`, `typecheck`, `test`, `build`, `budget`, `licenses` y `e2e` en CI. |
| T7-20 | Pendiente de medición manual en Android de gama baja; no cuenta como hecho. |

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| `caniuse-lite` (CC-BY-4.0) rompe `npm run licenses` | Excepción nominal aprobada (D10), solo para ese paquete, con comentario y ADR. |
| Playwright `context.setOffline` no corta las peticiones del service worker | Verificar con O2/O3. Si no funciona, detenerse y proponer una alternativa (por ejemplo, detener el preview tras la instalación). No simular el resultado. |
| `sw.js` supera 40 KB | Medir; si ocurre, anotar en ADR y pedir decisión. No subir el límite en silencio. |
| Workbox incluye URLs absolutas o `importScripts` | La auditoría falla; si es una constante inocua, añadirla a una lista permitida comentada. Si es `importScripts`, detenerse y preguntar. |
| Base distinta de `/` rompe enlaces o el registro | Se prueba con subruta en unitarias y en un build local; la demo aprobada usa `/`. |
| Node 20 de CI frente a Node 24 local | Ejecutar `npm ci` y `npm run build` con Node 20 antes de cerrar; registrar cualquier diferencia. |
| `indexHtml.test.ts` no ve el manifest inyectado | La fuente no lleva manifest; la unicidad se audita en `dist/` con `npm run budget`. |
| O5 falla por el contenido de muestra del bundle | La auditoría busca datos de la usuaria (código, PIN, justificación, respuestas), no el instrumento de muestra. |
| `Page.getInstallabilityErrors` cambia de forma | Confirmar la respuesta real en Playwright 1.64.1; si cambia, adaptar sin debilitar la aserción y anotarlo. |
| Vulnerabilidades reportadas por `npm ci` | Son previas a T7; se reportan en el PR y no se corrigen en esta tarea. |

---

## 9. Orden de ejecución y commits

| Fase | Contenido | Verificación | Commits sugeridos |
| --- | --- | --- | --- |
| 0 | Línea base | `npm ci`, `lint`, `typecheck`, `test`, `build`, `licenses` | — |
| 7a | Dependencias, `manifest.ts`, íconos, `vite.config.ts`, `index.html`, `indexHtml.test.ts` | `npm run build`, revisar `dist/`, `npm test`, `typecheck` | `chore(pwa): instala vite-plugin-pwa y workbox`, `feat(pwa): agrega el manifiesto y los íconos neutrales`, `test(pwa): cubre el manifiesto y los metadatos del HTML` |
| 7b | `swStatus.ts`, `registerServiceWorker.ts`, `main.tsx`, avisos, i18n | `npm test`, `typecheck`, `lint` | `feat(pwa): agrega el estado del service worker`, `feat(pwa): muestra los avisos de conexión y actualización`, `test(pwa): cubre el estado del service worker` |
| 7c | `check-budget.mjs`, `bundle-budget.json`, script raíz, CI | `npm run build && npm run budget` | `feat(pwa): agrega el presupuesto del build`, `ci(pwa): ejecuta el presupuesto tras el build` |
| 7d | `caseFlowSteps.ts`, `pwa.ts`, `offline.spec.ts`, `installability.spec.ts`, `perf.spec.ts` | `npm run e2e` | `test(pwa): cubre el flujo offline y la instalabilidad` |
| 7e | ADR-0008, threat model, README, AGENTS, TR-001, verificación manual | Suite completa y revisión de documentación | `docs(pwa): documenta las decisiones y los límites de la PWA`, `docs(pwa): actualiza el estado de T7` |

Puertas:

- No se pasa de 7a a 7b sin `npm run build` verde y sin revisar `dist/`.
- No se pasa de 7b a 7c sin unitarias de `swStatus` verdes.
- No se pasa de 7c a 7d sin `npm run budget` verde.
- No se pasa de 7d a 7e sin `npm run e2e` verde.
- 7e no se cierra sin `lint`, `typecheck`, `test`, `build`, `budget`, `licenses` y `e2e` verdes, y sin la verificación manual T7-16 registrada.

---

## 10. Pendientes y decisiones humanas

1. **Aprobado:** base `/`, nombre `SaviaTech`, ícono neutral, excepción de `caniuse-lite`.
2. **Pendiente:** URL y HTTPS definitivos de la demo para la prueba en teléfono; se documenta la opción usada.
3. **Pendiente:** aprobación visual final del ícono por una persona.
4. **Hecho:** verificación manual T7-16 (actualización) registrada en el README el 2026-11-02. **Pendiente:** T7-20 (Android de gama baja); no se marca como hecha sin registro real.
5. **Fuera de T7:** prueba e2e de actualización con dos builds, botón propio de instalación y bloqueo entre pestañas.
