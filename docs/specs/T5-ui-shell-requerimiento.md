# T5 — Shell de UI: router, pantalla de PIN, auto-lock, salida rápida, i18n y ajustes

**Repositorio:** frontend (PWA, `proyecto-savia-tech-web`). El backend/API NO se toca en esta tarea.
**Dependencias:** T1, T2, T3 y T4 terminadas. Antes de empezar, lee `AGENTS.md`, `docs/specs/TR-001-vertical-slice.md` (secciones 5, 6.2, 7 y 8), `docs/adr/0003-local-encryption.md`, `docs/adr/0005-case-storage.md`, `docs/threat-model.md`, `apps/web/src/crypto/README.md` y el código de `apps/web/src/crypto/` y `apps/web/src/storage/`. Adapta nombres, rutas y tipos a lo que ya existe. No dupliques módulos.
**Referencia visual (solo flujo y textos, no código):** `docs/design/savia_demo.html`.
**Auditoría posterior:** el código será revisado línea por línea por una persona y por otro agente. Comenta en español la lógica de seguridad, como en T3 y T4.
**Modelo de trabajo:** este requerimiento está escrito para un modelo pequeño. Trabaja en pasos cortos, un archivo a la vez, y ejecuta las pruebas después de cada paso. **Antes de usar cualquier función, tipo o ruta, ábrela y confirma su firma real.** No supongas APIs. Si te falta contexto, vuelve a leer `AGENTS.md` y este documento.

---

## 1. Objetivo

Construir el «cascarón» de la app sobre lo que ya existe: la persona profesional abre la app, crea o ingresa su PIN, navega entre pantallas, y la app se bloquea sola (inactividad, página oculta) o a demanda (botón Bloquear, salida rápida). Todo en español e inglés, y sin tocar datos de casos desde la UI salvo a través del repositorio de T4.

Escenario de amenaza (el mismo de T3/T4): alguien hostil con acceso al teléfono. La UI debe fallar hacia el lado seguro: ante cualquier duda, bloquear; nunca mostrar contenido protegido mientras el almacén no esté desbloqueado, ni siquiera durante un fotograma.

T5 **no** construye los flujos de caso, consentimiento, tamizaje, resultado ni remisiones (eso es T6). Deja una pantalla «Inicio» provisional y un mecanismo para que T6 enchufe sus pantallas.

## 2. Reglas no negociables

Rigen todas las de `AGENTS.md`, T3 y T4. Además, para esta tarea:

1. **Datos sintéticos únicamente.** Ningún dato real en código, pruebas, capturas ni ejemplos.
2. **El PIN nunca se guarda.** Ni en estado de React, contexto, `ref` persistente, `localStorage`, `sessionStorage`, URL, `console.*`, atributos del DOM ni mensajes de error. El campo se lee al enviar y se **vacía siempre** (también si falla), en un `finally`.
3. **No muestres `error.message`** al usuario. Cada error se traduce a una clave de i18n. Los mensajes de error de `crypto/` están en inglés y son para desarrolladores.
4. **No modifiques `apps/web/src/crypto/`** ni las constantes de PBKDF2. Si crees que hace falta un cambio, detente y pregunta.
5. **No añadas dependencias de ejecución.** No hay librería de router ni de i18n: se escriben a mano (son pequeñas). La única dependencia nueva permitida es `@playwright/test` como `devDependency` (ya está pre-aprobada en `AGENTS.md`), ver decisión D1. Para cualquier otra, detente y pregunta.
6. **CSP estricta.** `index.html` fija `default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'`. Por tanto: **prohibido el atributo `style={...}` de React, los `<style>` en línea y los scripts en línea.** Todo el CSS va en archivos `.css` importados desde el código. No relajes la CSP; si algo choca, detente y pregunta.
7. **Cero red de terceros** en ejecución: sin CDN, fuentes remotas, analítica ni reportadores de errores. Usa la pila de fuentes del sistema.
8. **Sin `any`, sin `@ts-ignore`, sin `eslint-disable`** (salvo la excepción declarada en D2). Nunca desactives una prueba ni una regla para que la tarea pase.
9. **No amplíes el alcance** (sección 3). Si algo es ambiguo o choca con el código, pregunta antes de decidir.
10. Tsconfig es estricto: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` (usa `import type`), `noUnusedLocals`. Escribe pensando en eso desde el inicio.
11. Todo archivo nuevo lleva la cabecera `// SPDX-License-Identifier: GPL-3.0-or-later` (los `.css` y `.json` quedan cubiertos por la licencia del paquete; pon la cabecera solo donde el formato admite comentarios).

## 3. Alcance

**Entra en T5:**

- Raíz de composición: crea el único `keyring`, el repositorio de casos y los controladores, y los expone a la UI.
- Controlador de la bóveda (`vaultController`) con suscripción para React.
- Router **en memoria** (sin datos en la URL) y compuerta de acceso.
- Pantalla de arranque, configuración de PIN, desbloqueo (con espera por intentos fallidos) y errores fatales.
- Auto-lock por inactividad y al ocultar la página.
- Salida rápida y pantalla neutral «Notas».
- Registro de «estado volátil» que T6 usará para que el bloqueo y la salida rápida descarten casos en curso.
- i18n es/en hecho a mano, con selector de idioma.
- Pantalla de Ajustes: idioma, tiempo de auto-lock, estado del almacenamiento persistente.
- Petición de almacenamiento persistente y aviso si no se concede.
- Pantalla «Inicio» provisional (sin lista de casos).
- Estilos base accesibles (claro/oscuro), pruebas unitarias, pruebas e2e de bloqueo y salida rápida, ADR y documentos.

**No entra en T5** (no lo construyas):

- Lista de casos, crear caso, consentimiento, tamizaje, alerta de seguridad, resultado, remisiones (T6).
- Service worker, manifiesto, `vite-plugin-pwa`, prueba offline, presupuesto de rendimiento (T7).
- **Cambio de PIN** desde la UI (ver D6), borrado de emergencia, respaldo, recuperación de PIN.
- Notificaciones, atajos de teclado globales, analítica.
- Opción de **desactivar** el auto-lock. No debe existir.
- Cualquier cambio en `crypto/`, en el esquema de Dexie o en `packages/rules`.

## 4. Decisiones (usa el valor por defecto y regístralo en el ADR-0006; una persona puede cambiarlo)

| ID | Decisión | Por defecto |
| --- | --- | --- |
| **D1** | Herramienta de pruebas de UI. `AGENTS.md` dice que `npm run e2e` llega en T7, pero TR-001 §9 exige e2e de bloqueo y salida rápida en T5. No hay `jsdom` ni Testing Library (no están pre-aprobados). | La lógica va en módulos TypeScript puros probados con Vitest en Node (sin DOM). El comportamiento de pantalla se prueba con **Playwright** (pre-aprobado) sobre `vite preview`, así también se valida la CSP real. Se añade `npm run e2e` y un job `e2e` aparte en CI. Corrige la frase de `AGENTS.md` y del README que lo sitúan en T7. |
| **D2** | Dónde guardar idioma y tiempo de auto-lock. Deben leerse **antes** de desbloquear (la pantalla de PIN ya debe salir en el idioma elegido), así que no pueden ir cifrados. No son datos sensibles. | `localStorage`, clave única `saviatech.settings`, a través de **un solo módulo** (`settings/settingsStore.ts`). ESLint y la prueba estática prohíben `localStorage` en cualquier otro archivo. Es la única excepción a la regla 2 de `AGENTS.md` y es solo para estos dos valores. Alternativa descartada por ahora: tabla Dexie v3 en claro (más migración, mismo nivel de exposición). |
| **D3** | Router. | **En memoria**, con la URL constante (sin hash, sin query, sin ids de caso). Así «Atrás» del navegador nunca revela pantallas sensibles. Coste: el botón Atrás de Android sale de la app en lugar de retroceder dentro de ella; se ofrece un botón «Volver» en pantalla. Si T6 necesita Atrás nativo, se revisa con un ADR. |
| **D4** | Salida rápida en la pantalla de PIN. TR-001 dice «en cada pantalla desbloqueada». | También visible en configuración/desbloqueo de PIN: es el mismo botón, no hay estado que limpiar, y esa pantalla delata el nombre de la app. Una persona puede vetarlo. |
| **D5** | Opciones de auto-lock. | 1, 2 y 5 minutos. Por defecto 2. Cualquier valor fuera de esa lista (por ejemplo, manipulado en `localStorage`) se ignora y se usa 2. |
| **D6** | Cambiar el PIN desde la UI. `keyring.changePin` existe, pero TR-001 no lo incluye en Ajustes. | **No se construye en T5.** Queda anotado en el ADR y en el resumen final como pregunta humana: si alguien sabe el PIN, la profesional no podría cambiarlo. |
| **D7** | Valor de `document.title`. | Con la app bloqueada o desbloqueada: `VITE_APP_NAME`. En la pantalla neutral: el texto localizado «Notas»/«Notes». |

## 5. Diseño

### 5.1 Estructura de archivos

Adapta a lo que ya exista; no dupliques nada de `crypto/` ni `storage/`.

```
apps/web/src/main.tsx                       (cablea estilos y la raíz; ya existe)
apps/web/src/App.tsx                        (monta proveedores y <Shell/>; ya existe)
apps/web/src/app/createApp.ts               (raíz de composición, sin efectos al importar)
apps/web/src/app/AppContext.tsx             (contexto React con las dependencias)
apps/web/src/session/vaultController.ts
apps/web/src/session/volatileState.ts
apps/web/src/session/autoLock.ts
apps/web/src/session/quickExit.ts
apps/web/src/router/router.ts
apps/web/src/router/routes.ts
apps/web/src/i18n/es.json
apps/web/src/i18n/en.json
apps/web/src/i18n/index.ts                  (tipos, t(), detección de idioma)
apps/web/src/i18n/I18nProvider.tsx
apps/web/src/settings/settingsStore.ts
apps/web/src/ui/Shell.tsx
apps/web/src/ui/screens/{StartupScreen,PinSetupScreen,PinUnlockScreen,FatalErrorScreen,HomeScreen,SettingsScreen,NeutralScreen}.tsx
apps/web/src/ui/components/{Header,QuickExitButton,LanguageToggle,PersistenceWarning}.tsx
apps/web/src/ui/errors.ts                   (traduce errores de dominio a claves de i18n)
apps/web/src/styles/{tokens.css,base.css,components.css}
apps/web/e2e/*.spec.ts                      (Playwright)
apps/web/playwright.config.ts
docs/adr/0006-ui-shell.md
```

Cada módulo de `session/`, `router/`, `settings/` e `i18n/index.ts` es TypeScript **sin importar React ni tocar `document`/`window` directamente**: reciben lo que necesitan por parámetro. Así se prueban en Node.

### 5.2 Raíz de composición

`createApp()` devuelve un objeto con: `keyring` (de `createKeyring({ store: cryptoMetadataStore })`), `repository` (`createCaseRepository({ db: saviaDatabase, keyring })`), `vault` (el `vaultController`), `router`, `volatileState`, `settings` y `quickExit`. `main.tsx` o `App.tsx` lo llama **una vez**. Nada de singletons al importar módulos nuevos (los de T3/T4, `saviaDatabase` y `cryptoMetadataStore`, ya existen y se reutilizan tal cual).

Las pantallas **nunca** importan Dexie ni `crypto/` directamente. Para errores pueden importar las clases de error desde `crypto/` (solo para `instanceof`, en `ui/errors.ts`).

### 5.3 Controlador de la bóveda

```ts
export type VaultViewState = 'loading' | 'uninitialized' | 'locked' | 'unlocked' | 'failed';

export interface VaultSnapshot {
  readonly state: VaultViewState;
  /** Sube con cada bloqueo y con cada desbloqueo/creación; sirve de `key` del árbol protegido. */
  readonly epoch: number;
  /** Causa del fallo de arranque cuando state === 'failed'; null en otro caso. */
  readonly failure: 'crypto-unavailable' | 'storage' | 'corrupt' | 'unsupported-version' | null;
}

export interface VaultController {
  subscribe(listener: () => void): () => void;
  getSnapshot(): VaultSnapshot; // MISMA referencia mientras nada cambie (requisito de useSyncExternalStore)
  start(): Promise<void>; // keyring.load() -> uninitialized | locked | failed
  setup(pin: string): Promise<void>; // keyring.initialize(pin) -> unlocked
  unlock(pin: string): Promise<void>; // keyring.unlock(pin) -> unlocked
  lock(): void; // idempotente
}

export function createVaultController(deps: {
  keyring: Keyring;
  volatileState: VolatileStateRegistry;
}): VaultController;
```

Reglas:

- Los errores de `setup`/`unlock` se **propagan** a la pantalla (que los traduce). El controlador no los atrapa ni los registra.
- `lock()` hace, **en este orden**: (1) `keyring.lock()`; (2) `volatileState.clearAll()`; (3) sube `epoch` y publica el estado `locked` (o `uninitialized` si el almacén nunca se creó). Cada paso tolera que el anterior haya fallado (`try`/`finally`): el paso 1 nunca se omite.
- El estado `unlocked` solo se publica si `keyring.getState() === 'unlocked'` justo después de que la operación termine. Si `lock()` ocurrió mientras `unlock`/`setup` estaban en curso, el llavero lanza `VaultLockedError` y el controlador **no** publica `unlocked`.
- `start()` clasifica los fallos: `CryptoUnavailableError` → `crypto-unavailable`; `CorruptDataError` → `corrupt`; `UnsupportedVersionError` → `unsupported-version`; cualquier otro (Dexie, IndexedDB no disponible) → `storage`.

### 5.4 Estado volátil

```ts
export interface VolatileStateRegistry {
  register(clear: () => void): () => void; // devuelve la función para anular el registro
  clearAll(): void; // llama a todas; si una lanza, sigue con las demás
}
```

T6 registrará aquí el estado «caso en curso» (antes del consentimiento vive solo en memoria, ver TR-001 §6.2). T5 solo construye el registro y lo prueba con dobles. Además, el árbol protegido se monta con `key={snapshot.epoch}`: tras cada bloqueo React desmonta todo y se descarta el estado de los componentes.

### 5.5 Auto-lock

```ts
export interface AutoLockOptions {
  isUnlocked: () => boolean;
  lock: () => void;
  getTimeoutMs: () => number;
  /** `document` en producción; un `EventTarget` en las pruebas. */
  documentEvents: EventTarget;
  /** `window` en producción (para `pagehide`). */
  windowEvents: EventTarget;
  isHidden: () => boolean; // () => document.hidden
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}
export interface AutoLock {
  stop(): void;
  /** Reinicia la cuenta (se llama al cambiar el tiempo en Ajustes). */
  notifyActivity(): void;
}
export function startAutoLock(options: AutoLockOptions): AutoLock;
```

Reglas:

- **Actividad** que reinicia la cuenta: `pointerdown`, `keydown`, `touchstart`, `wheel` en `documentEvents`. Solo cuenta si está desbloqueado.
- **Por plazo, no solo por temporizador.** Guarda `lastActivityAt`. Al vencer el temporizador, comprueba `now() - lastActivityAt >= timeout`; si no se cumple, reprograma por el tiempo restante. Los navegadores móviles retrasan los temporizadores; la comparación de horas evita que la app se quede abierta de más.
- **Al ocultarse la página** (`visibilitychange` con `isHidden() === true`, y `pagehide`): `lock()` **inmediato**, sin esperar al plazo.
- Al volver a la pestaña (`visibilitychange` visible) comprueba el plazo igualmente.
- Un único conjunto de listeners; `stop()` los quita todos y cancela el temporizador. Nada de listeners duplicados al re-renderizar (StrictMode monta dos veces: pruébalo).
- Sin `console.*`, sin guardar nada en disco.

### 5.6 Salida rápida

```ts
export interface QuickExitDeps {
  lock: () => void; // vaultController.lock (ya limpia el estado volátil)
  showNeutral: () => void; // router.showNeutral
  replaceHistory: () => void; // () => history.replaceState(null, '', location.pathname)
  setTitle: () => void; // pone el título neutral localizado (D7)
}
export function createQuickExit(deps: QuickExitDeps): () => void;
```

Orden: (1) `lock()`; (2) `showNeutral()`; (3) `replaceHistory()`; (4) `setTitle()`. **Cada paso va en su propio `try`** para que un fallo no omita los siguientes; el paso 1 es el crítico. Es una función síncrona y no espera a nada (ni a PBKDF2 ni a la red): un toque, efecto inmediato.

Efecto esperado: el DOM deja de contener texto sensible y el nombre de la app; la bóveda queda bloqueada; el estado volátil queda descartado; recargar la página lleva a la pantalla de PIN. El navegador puede conservar entradas de historial o capturas del conmutador de apps que la app no controla: documéntalo en el modelo de amenazas (best effort).

### 5.7 Router en memoria

```ts
export type Route = { readonly name: 'home' } | { readonly name: 'settings' };
// T6 añadirá aquí sus rutas. Ninguna ruta lleva datos del caso en su contenido visible en la URL.

export interface RouterSnapshot {
  readonly view: 'app' | 'neutral';
  readonly route: Route;
  readonly canGoBack: boolean;
}
export interface Router {
  subscribe(listener: () => void): () => void;
  getSnapshot(): RouterSnapshot; // referencia estable si no cambia
  navigate(route: Route): void;
  back(): void;
  reset(): void; // pila vacía, ruta 'home'; se llama en cada bloqueo
  showNeutral(): void;
  leaveNeutral(): void; // vuelve a view 'app'; la compuerta decide qué se ve
}
```

La pila de rutas vive solo en memoria. La URL no cambia nunca. `reset()` se llama desde el bloqueo (suscríbete al `epoch` o llámalo desde `lock`, lo que quede más simple y probado).

### 5.8 Compuerta (`Shell.tsx`)

Se evalúa en este orden y **la primera condición verdadera gana**:

1. `router.view === 'neutral'` → `NeutralScreen` (tiene prioridad sobre todo, incluso en el estado `loading`).
2. `vault.state === 'loading'` → `StartupScreen`.
3. `vault.state === 'failed'` → `FatalErrorScreen` (según `failure`; «Reintentar» llama a `start()`; **sin** opción de borrar datos).
4. `vault.state === 'uninitialized'` → `PinSetupScreen`.
5. `vault.state === 'locked'` → `PinUnlockScreen`.
6. `vault.state === 'unlocked'` → árbol protegido (`Header` + pantalla según `router.route`) con `key={vault.epoch}`.

Ninguna pantalla protegida se renderiza si el estado no es `unlocked`. Prohibido «renderizar y ocultar con CSS».

### 5.9 Pantallas de PIN

- **Configuración** (`uninitialized`): dos campos (PIN y confirmación), texto de ayuda y la advertencia de que olvidar el PIN no tiene recuperación. Valida en el cliente: solo dígitos y mínimo `PIN_MIN_LENGTH` (impórtalo de `crypto/constants`, no pongas un 6 fijo) y que coincidan. Sin límite máximo en la interfaz. Al enviar llama a `vault.setup(pin)`; si va bien, queda `unlocked` y se pide almacenamiento persistente (5.11).
- **Desbloqueo** (`locked`): un campo y botón. Llama a `vault.unlock(pin)`.
- Campos: `type="password"`, `inputmode="numeric"`, `autocomplete="off"`, con `<label>` asociado (no solo placeholder). Foco automático en el primer campo al montar. Se pueden enviar con Enter. Sin botón de «mostrar PIN» (v1).
- **Ocupado**: PBKDF2 con 600.000 iteraciones puede tardar segundos en un teléfono modesto. Mientras tanto: botón deshabilitado, `aria-busy`, texto «Verificando…». Evita doble envío. Los botones de salida rápida e idioma **siguen activos**.
- **Errores** (en una región `role="alert"` o `aria-live="assertive"`), vía `ui/errors.ts`:
  - `InvalidPinError` o validación local → `pin.error.format`.
  - `IncorrectPinError` → `pin.error.incorrect` (mensaje genérico, sin pistas).
  - `TooManyAttemptsError` → `pin.error.wait` con `{seconds}` calculado de `retryAfterMs` (redondeo hacia arriba). Cuenta atrás visible que se actualiza cada segundo (región `aria-live="polite"`, sin anunciar cada segundo: anuncia al inicio y al terminar), botón deshabilitado hasta llegar a 0. Limpia el temporizador al desmontar.
  - `VaultLockedError` → **silencio**: significa que un bloqueo (salida rápida, página oculta) canceló la operación. No muestres error.
  - `VaultAlreadyInitializedError` → refresca el estado con `vault.start()` (otra pestaña lo creó) y no muestres detalles.
  - Cualquier otro → `pin.error.generic`.
- El campo se vacía en un `finally`, haya ido bien o mal. Tras un fallo, devuelve el foco al campo.
- Ten presente: la espera por intentos fallidos ya persiste en los metadatos (T3). La pantalla solo conoce el tiempo restante después de un intento rechazado; no añadas lecturas nuevas de metadatos.

### 5.10 i18n a mano

- `es.json` y `en.json` con **claves planas** (`"pin.error.format": "..."`). Idioma por defecto: `es`.
- `i18n/index.ts`: `type MessageKey = keyof typeof es`; `en.json` se tipa como `Record<MessageKey, string>` (la paridad se verifica al compilar). `translate(locale, key, params?)` sustituye `{nombre}` por valores; si falta un parámetro, deja el marcador sin romper.
- `detectLocale(languages: readonly string[])`: si el primer idioma empieza por `en` → `en`; en cualquier otro caso → `es`. Se usa solo si no hay idioma guardado.
- `I18nProvider` expone `{ locale, t, setLocale }`. Al cambiar el idioma: actualiza `document.documentElement.lang`, persiste con `settingsStore` y re-renderiza **sin recargar**.
- Ningún texto visible para el usuario va fijo en los componentes. Incluye `aria-label`, `title`, `alt` y mensajes de error.
- Sin plurales complejos: los textos se redactan para no necesitarlos.

**Cadenas exactas** (créalas tal cual; no inventes variantes). Las claves son las mismas en los dos archivos.

| Clave | es | en |
| --- | --- | --- |
| `app.loading` | Cargando… | Loading… |
| `app.fatal.title` | No se puede iniciar la aplicación | The app cannot start |
| `app.fatal.cryptoUnavailable` | Este navegador o contexto no permite el cifrado seguro. Abre la aplicación desde su dirección segura (HTTPS). | This browser or context does not allow secure encryption. Open the app from its secure (HTTPS) address. |
| `app.fatal.storage` | No se pudo acceder al almacenamiento del dispositivo. Cierra otras pestañas de la aplicación e inténtalo de nuevo. | The device storage could not be accessed. Close other tabs of the app and try again. |
| `app.fatal.corrupt` | Los datos de seguridad guardados no se pueden leer. No borres nada y consulta a la persona responsable del proyecto. | The stored security data cannot be read. Do not delete anything and contact the project owner. |
| `app.fatal.unsupportedVersion` | Los datos guardados vienen de una versión más reciente de la aplicación. Actualiza la aplicación. | The stored data comes from a newer version of the app. Update the app. |
| `app.fatal.retry` | Reintentar | Retry |
| `pin.setup.title` | Crea un PIN | Create a PIN |
| `pin.setup.hint` | Usa al menos 6 dígitos. Evita fechas o secuencias que otra persona pueda adivinar. | Use at least 6 digits. Avoid dates or sequences someone else could guess. |
| `pin.setup.warning` | Si olvidas el PIN, los datos guardados en este dispositivo no se pueden recuperar. | If you forget the PIN, the data stored on this device cannot be recovered. |
| `pin.setup.submit` | Crear PIN | Create PIN |
| `pin.label` | PIN | PIN |
| `pin.confirm.label` | Confirma el PIN | Confirm the PIN |
| `pin.unlock.title` | Ingresa tu PIN | Enter your PIN |
| `pin.unlock.submit` | Entrar | Unlock |
| `pin.busy` | Verificando… | Checking… |
| `pin.error.format` | El PIN debe tener al menos 6 dígitos y solo números. | The PIN must have at least 6 digits and only numbers. |
| `pin.error.mismatch` | Los PIN no coinciden. | The PINs do not match. |
| `pin.error.incorrect` | PIN incorrecto. | Incorrect PIN. |
| `pin.error.wait` | Demasiados intentos. Espera {seconds} s para volver a intentar. | Too many attempts. Wait {seconds} s to try again. |
| `pin.error.generic` | No se pudo completar la operación. Inténtalo de nuevo. | The operation could not be completed. Try again. |
| `header.lock` | Bloquear | Lock |
| `header.quickExit` | Salida rápida | Quick exit |
| `header.settings` | Ajustes | Settings |
| `header.language.switchTo` | Cambiar idioma | Change language |
| `home.title` | Inicio | Home |
| `home.placeholder` | Pantalla provisional. La lista de casos llegará en la siguiente tarea. | Provisional screen. The case list will arrive in the next task. |
| `persist.warning` | Este dispositivo podría borrar los datos guardados por falta de espacio. No borres los datos del navegador y no dependas de una única copia. | This device may delete stored data when space runs low. Do not clear browser data and do not rely on a single copy. |
| `settings.title` | Ajustes | Settings |
| `settings.back` | Volver | Back |
| `settings.language` | Idioma | Language |
| `settings.language.es` | Español | Español |
| `settings.language.en` | English | English |
| `settings.autolock` | Bloqueo automático | Automatic lock |
| `settings.autolock.option` | {minutes} min | {minutes} min |
| `settings.autolock.help` | La aplicación se bloquea tras este tiempo sin actividad y cada vez que se oculta. | The app locks after this time without activity and every time it is hidden. |
| `settings.storage` | Almacenamiento | Storage |
| `settings.storage.granted` | Protegido contra borrado automático. | Protected from automatic deletion. |
| `settings.storage.denied` | No protegido contra borrado automático. | Not protected from automatic deletion. |
| `settings.storage.unsupported` | Este navegador no permite protegerlo. | This browser cannot protect it. |
| `settings.storage.usage` | {usage} MB usados de {quota} MB | {usage} MB used of {quota} MB |
| `neutral.title` | Notas | Notes |
| `neutral.empty` | No hay notas. | No notes. |
| `neutral.open` | Abrir | Open |

### 5.11 Ajustes y almacenamiento persistente

`settings/settingsStore.ts` (único archivo que puede usar `localStorage`, ver D2):

```ts
export type Locale = 'es' | 'en';
export const AUTO_LOCK_OPTIONS_MS = [60_000, 120_000, 300_000] as const;
export const DEFAULT_AUTO_LOCK_MS = 120_000;
export interface AppSettings { locale: Locale | null; autoLockMs: number } // locale null = sin elegir aún
export interface SettingsStore {
  load(): AppSettings;
  saveLocale(locale: Locale): void;
  saveAutoLockMs(ms: number): void; // rechaza valores fuera de AUTO_LOCK_OPTIONS_MS
}
export function createSettingsStore(storage: Pick<Storage, 'getItem' | 'setItem'> | null): SettingsStore;
```

- Un solo JSON en la clave `saviatech.settings`, con **solo** estos dos campos. Validación estricta al leer: cualquier cosa rara (JSON inválido, tipos incorrectos, un tiempo fuera de la lista) vuelve al valor por defecto de ese campo, sin lanzar.
- Si `storage` es `null` o lanza (modo privado, cuota), la app sigue funcionando con los valores en memoria.
- El selector de tiempo ofrece **solo** las opciones de la lista. No hay «nunca».

**Almacenamiento persistente.** Llama a `requestPersistentStorage()` (ya existe en `storage/`) **después** de un `setup` o `unlock` correctos, no al importar. Guarda el resultado en el estado de la app. Si es `denied` o `unsupported`, muestra `PersistenceWarning` (un aviso discreto, no bloqueante) en `HomeScreen` y el estado en Ajustes. Usa `estimateStorage()` en Ajustes para mostrar el uso (convierte a MB con un decimal; si devuelve `null`, no muestres la línea).

### 5.12 Estilos y accesibilidad

- Archivos CSS planos en `src/styles/`, enlazados desde `index.html` en orden `tokens.css`, `base.css`, `components.css` (ver ADR-0006). Variables CSS en `tokens.css`, modo claro por defecto y `@media (prefers-color-scheme: dark)`; `:root { color-scheme: light dark; }`.
- Tokens sugeridos (contrastes ya calculados; verifica que los usas tal cual):

| Token | Claro | Oscuro | Contraste |
| --- | --- | --- | --- |
| texto / fondo | `#1a1a1a` / `#ffffff` | `#f2f2f2` / `#121212` | 17,4 / 16,7 |
| texto secundario | `#525252` | `#b3b3b3` | 7,8 / 8,9 |
| botón primario | texto `#ffffff` sobre `#1d4ed8` | texto `#0b1220` sobre `#8ab4ff` | 6,7 / 9,0 |
| botón de salida rápida | texto `#ffffff` sobre `#b42318` | texto `#1a0000` sobre `#ff8a80` | 6,6 / 8,8 |
| texto de error | `#b42318` | `#ff8a80` | 6,6 / 8,2 |
| borde de controles | `#767676` | `#8a8a8a` | 4,5 / 5,4 |
| anillo de foco | `#1d4ed8` | `#8ab4ff` | 6,7 / 9,0 |

- Objetivos táctiles de **al menos 44×44 px**; foco visible (`:focus-visible`, anillo de 3 px) en todo control; no quites el contorno sin sustituirlo.
- `prefers-reduced-motion`: sin animaciones.
- Fuentes del sistema (`system-ui, sans-serif`). Sin imágenes remotas.
- Estructura semántica: `<header>`, `<main id="main">`, un `<h1>` por pantalla, enlace «saltar al contenido» no necesario en v1 si el encabezado tiene menos de 4 controles (puede omitirse). Al cambiar de pantalla protegida, mueve el foco al `<h1>` (`tabIndex={-1}`).
- **Botón de salida rápida:** siempre en la misma posición (arriba a la derecha), con el estilo de peligro, nunca oculto ni colapsado en un menú, nombre accesible `header.quickExit`. Visible en todas las pantallas desbloqueadas y (D4) en las de PIN. En la pantalla neutral **no** hay salida rápida ni selector de idioma.
- La pantalla neutral muestra solo `neutral.title`, `neutral.empty` y el botón `neutral.open`. Sin el nombre de la app, sin logos, sin selector de idioma. «Abrir» llama a `router.leaveNeutral()`; como la bóveda ya está bloqueada, la compuerta mostrará el PIN (nunca contenido protegido).

## 6. Pruebas

### 6.1 Unitarias (Vitest, entorno Node, sin DOM)

Cada módulo de lógica tiene su `__tests__/` al lado. Usa llavero real con `DexieCryptoMetadataStore` y `fake-indexeddb`, reutilizando el mecanismo de iteraciones reducidas que ya usan las pruebas de `crypto/` (no toques las constantes de producción). Para el reloj usa `vi.useFakeTimers()` o los `now/setTimer` inyectables. Para eventos usa el `EventTarget` global de Node.

- `vaultController`: transiciones `loading → uninitialized/locked/failed`; `setup` y `unlock` terminan en `unlocked`; `lock` limpia estado volátil, sube `epoch` y deja `keyring.getState() !== 'unlocked'`; `lock()` durante un `unlock` en curso **no** publica `unlocked`; `getSnapshot()` es estable entre cambios; clasificación de fallos de `start()` con un `store` que lanza cada tipo de error.
- `volatileState`: `clearAll` llama a todos aunque uno lance; anular el registro funciona.
- `autoLock`: bloquea tras el plazo; la actividad reinicia; no bloquea si ya está bloqueado; al ocultarse bloquea de inmediato; temporizador tardío (el reloj salta más que el plazo) bloquea igualmente; `stop()` quita listeners; cambiar el plazo con `notifyActivity()` surte efecto; arrancar dos veces y parar una no deja listeners huérfanos.
- `quickExit`: orden de las llamadas; si un paso lanza, los siguientes se ejecutan; el paso 1 se ejecuta siempre.
- `router`: `navigate`, `back`, `reset`, `showNeutral`, `leaveNeutral`; snapshot estable; `canGoBack`.
- `settingsStore`: valores por defecto; JSON inválido; tipos erróneos; tiempo fuera de la lista vuelve a 120 000; `storage` nulo o que lanza no rompe; `saveAutoLockMs(45_000)` se rechaza.
- `i18n`: `es.json` y `en.json` tienen **exactamente las mismas claves** y ninguna cadena vacía; todo `{parámetro}` de `es` aparece también en `en`; `translate` sustituye parámetros; `detectLocale`; **todas las claves usadas** en `src/**/*.ts(x)` mediante `t('clave')` existen en `es.json` (búsqueda por expresión regular sobre el código fuente) y no sobran claves sin usar (si alguna queda para T6, márcala en una lista blanca comentada).
- `ui/errors.ts`: cada clase de error de `crypto/` produce la clave esperada, `TooManyAttemptsError` calcula segundos hacia arriba y `VaultLockedError` produce «silencio».
- **Prueba estática** (extiende o copia la de T3/T4): en `src/session`, `src/router`, `src/i18n`, `src/ui` y `src/app` no aparece `Math.random`, `console.`, `localStorage`, `sessionStorage`, ni el atributo `style=`; en todo `src` (salvo `settings/settingsStore.ts`, que solo puede usar `localStorage`) tampoco. Añade además la regla equivalente en `eslint.config.js` (bloque para `apps/web/src/**` con `no-console`, `no-restricted-globals` y `Math.random`, y la excepción acotada para `settingsStore.ts`). Verifica que la regla nueva no rompe archivos de T3/T4.

### 6.2 e2e (Playwright, Chromium, sobre `vite preview` tras `vite build`)

`apps/web/playwright.config.ts` arranca `npm run build` + `vite preview` y usa un contexto limpio por prueba. Usa las constantes de producción del KDF (puede tardar unos segundos): da tiempos de espera generosos. Toda prueba comprueba además que **no hubo** eventos `securitypolicyviolation`, errores de consola ni peticiones a otros orígenes.

1. Primera ejecución: aparece la configuración del PIN; rechaza PIN corto y no numérico; rechaza confirmación distinta; con un PIN válido entra a Inicio.
2. Recargar: aparece el desbloqueo, **no** Inicio. PIN incorrecto → mensaje genérico y campo vacío; PIN correcto → Inicio.
3. Espera tras fallos: tras 3 PIN incorrectos aparece la cuenta atrás y el botón queda deshabilitado; (con `page.clock`) al cumplirse el tiempo se habilita.
4. Auto-lock: con `page.clock`, avanzar el plazo por defecto bloquea; con actividad intermedia no bloquea; cambiar a 1 min en Ajustes y avanzar 61 s bloquea.
5. Página oculta: simular `visibilitychange` con `document.hidden = true` bloquea al instante.
6. Salida rápida desde Inicio y desde Ajustes: aparece «Notas»; el texto de la app, «Inicio» y «Ajustes» **no están en el DOM**; `document.title` es «Notas»; «Abrir» lleva al PIN (no a Inicio); recargar lleva al PIN. Repite desde la pantalla de PIN (D4).
7. Salida rápida durante un desbloqueo en curso: no queda desbloqueado ni muestra error.
8. Idioma: cambiar entre es y en actualiza los textos y `<html lang>` sin recargar y persiste tras recargar; un valor basura en `localStorage` vuelve a los valores por defecto.
9. Ajustes: solo hay opciones 1, 2 y 5 min; no existe opción de desactivar.
10. CSP: la página no genera ninguna violación y el DOM no contiene atributos `style`.

Los tiempos de PBKDF2 en Node/Chromium **no** demuestran rendimiento en un Android de gama baja; sigue pendiente la medición manual (se anota en el README junto a las de T3/T4).

## 7. Criterios de aceptación

| ID | Criterio |
| --- | --- |
| T5-01 | Arranque: según `keyring.load()` se muestra configuración de PIN, desbloqueo o error fatal. Ninguna pantalla protegida se renderiza mientras el estado no sea `unlocked`. |
| T5-02 | Configuración del PIN: solo dígitos, mínimo `PIN_MIN_LENGTH`, confirmación obligatoria, advertencia de irrecuperabilidad visible. El campo se vacía siempre. El PIN no aparece en estado persistente, DOM tras enviar, URL ni consola. |
| T5-03 | Desbloqueo: PIN incorrecto da mensaje genérico; la espera por intentos fallidos muestra cuenta atrás y deshabilita el botón; `VaultLockedError` no muestra error. |
| T5-04 | Auto-lock por inactividad (por defecto 2 min), basado en plazo y no solo en temporizador; la actividad lo reinicia. |
| T5-05 | La página oculta (`visibilitychange`, `pagehide`) bloquea de inmediato. |
| T5-06 | Todo bloqueo: `keyring.getState() !== 'unlocked'`, estado volátil descartado, árbol protegido desmontado, ruta reiniciada. |
| T5-07 | Salida rápida (un toque, síncrona) visible en cada pantalla desbloqueada y en las de PIN: bloquea, descarta estado, muestra «Notas», reemplaza el historial y pone el título neutral. «Abrir» nunca lleva a contenido protegido. |
| T5-08 | Un `lock` durante `unlock`/`setup` en curso no publica `unlocked` ni muestra error. |
| T5-09 | i18n: paridad es/en comprobada, todas las claves usadas existen, cambio de idioma inmediato, persistente y con `<html lang>` actualizado. No hay texto fijo en los componentes. |
| T5-10 | Ajustes: idioma y auto-lock (1/2/5 min). Valores inválidos en `localStorage` caen a los predeterminados. No existe opción de desactivar el bloqueo. |
| T5-11 | `requestPersistentStorage` se llama tras `setup`/`unlock`, nunca al importar; aviso visible en Inicio y estado en Ajustes si no se concede. |
| T5-12 | La CSP se cumple: sin violaciones, sin `style=`, sin scripts ni estilos en línea y sin peticiones a otros orígenes (verificado en e2e). |
| T5-13 | Accesibilidad: etiquetas asociadas, foco visible, objetivos ≥ 44 px, contraste AA con los tokens indicados, claro y oscuro, `aria-live` en errores y cuenta atrás, foco gestionado, `prefers-reduced-motion`. |
| T5-14 | La prueba estática y la regla de ESLint prohíben `Math.random`, `console`, `localStorage`/`sessionStorage` (salvo `settingsStore.ts`) y `style=` en los directorios de T5. |
| T5-15 | Sin dependencias de ejecución nuevas. Solo `@playwright/test` como `devDependency`, y `npm run licenses` pasa. El JavaScript inicial sigue ≤ 250 KB gzip y se reporta el tamaño real. |
| T5-16 | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run licenses` y `npm run e2e` pasan. Se reporta el resultado real. |

## 8. Documentación que debe actualizar T5

- `docs/adr/0006-ui-shell.md` (corto, en inglés): router en memoria y por qué (D3), ajustes en `localStorage` con excepción acotada (D2), Playwright (D1), orden del bloqueo y de la salida rápida, opciones de auto-lock (D5), salida rápida en la pantalla de PIN (D4), `document.title` (D7), y la pregunta abierta de cambio de PIN (D6).
- `docs/threat-model.md`: sección «Implemented UI shell controls (T5)» y nuevos límites: Android Back sale de la app; capturas del conmutador de apps y entradas de historial que el navegador conserva; `localStorage` con `saviatech.settings` visible y manipulable (no protege nada); la cuenta atrás solo se conoce tras un intento rechazado; un PIN conocido por la persona hostil no se puede cambiar desde la UI (D6); el mensaje de la pestaña oculta aún puede aparecer en el conmutador de apps hasta que el navegador lo bloquee.
- `apps/web/src/crypto/README.md`: sección «UI integration».
- `docs/specs/TR-001-vertical-slice.md`: estado «T5 implemented» y la frase de §9 sobre e2e acorde con D1.
- `AGENTS.md` y `README.md`: `npm run e2e` existe desde T5 (la prueba **offline** sigue siendo T7); quita «The app is a minimal shell until tasks T5 and T6» según corresponda.
- `.github/workflows/ci.yml`: job `e2e` aparte (instala Chromium con `npx playwright install --with-deps chromium`).
- `SECURITY.md`: solo si cambia algo del reporte o de los límites declarados.

## 9. Forma de trabajo

1. **Línea base.** Antes de tocar nada: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run licenses`. Reporta el resultado.
2. **Plan primero.** Presenta el plan, los supuestos, las preguntas abiertas y cómo verificarás cada criterio T5-01 a T5-16. **Espera aprobación.** Pregunta explícitamente por las decisiones D1 a D7 si dudas de alguna.
3. Rama `feat/t5-ui-shell`, con commits convencionales y descripciones en español (por ejemplo `feat(session): agrega el bloqueo automático`).
4. Orden sugerido, con revisión humana entre pasos:
   - **5a:** `i18n/` (JSON, `index.ts`, pruebas), `settings/settingsStore.ts` y pruebas, regla de ESLint y prueba estática (T5-09, parte de T5-10, T5-14).
   - **5b:** `session/` (`vaultController`, `volatileState`, `autoLock`, `quickExit`) y `router/`, todos con pruebas unitarias (T5-04 a T5-08).
   - **5c:** raíz de composición, `Shell`, pantallas, componentes y CSS (T5-01 a T5-03, T5-10, T5-11, T5-13). Verifica con `npm run build && npm run preview`, no solo con `npm run dev`.
   - **5d:** Playwright, CI, ADR y documentos (T5-12, T5-15, T5-16).
5. **Riesgo conocido de CSP en desarrollo.** El servidor de desarrollo de Vite inyecta estilos en línea, y la CSP de `index.html` puede bloquearlos en `npm run dev`. **No relajes la CSP de producción.** Verifica en `preview`; si `dev` queda inutilizable, detente y propón (sin implementarlo) una alternativa solo para desarrollo.
6. Antes de dar la tarea por terminada, ejecuta lint, typecheck, tests, build, licenses y e2e, y **reporta el resultado real**, también si algo falla.
7. Cierra con: qué cambió, qué te dejó dudas, qué necesita una decisión humana (en particular D1, D2, D4 y D6) y qué quedó sin medir (rendimiento en Android de gama baja).

## 10. Pendiente para T6 y TR-002 (no hacer ahora)

- T6: lista de casos, flujos de caso, consentimiento, tamizaje, alerta de seguridad, resultado y remisiones; registrar su estado «en curso» en el `volatileState`; ignorar resultados asíncronos que lleguen después de un bloqueo (comparar `epoch`).
- T7: service worker, manifiesto, prueba offline, presupuesto de rendimiento, nombre de app e iconos configurables.
- Más adelante: cambio de PIN desde la UI, PIN más largo o frase de paso, bloqueo entre pestañas, mostrar/ocultar PIN, rechazo de PIN triviales, nombre de la base configurable (D3 de T4).
