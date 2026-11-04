# T7 — PWA y offline: service worker, manifiesto, prueba offline y presupuesto de rendimiento

**Versión:** 0.1
**Especificación de implementación:** `docs/specs/T7-pwa-offline-spec.md` (documento compañero; este requerimiento es la base normativa).
**Repositorio:** frontend (PWA, `proyecto-savia-tech-web`). El backend no existe en este repositorio y queda para TR-002. No lo toques ni lo simules.
**Dependencias:** T1 a T6 terminadas. Antes de empezar, lee `AGENTS.md`, `docs/specs/TR-001-vertical-slice.md` (secciones 3, 4, 5, 7, 8 y 10), `docs/adr/0001-monorepo-and-tooling.md`, `docs/adr/0006-ui-shell.md`, `docs/adr/0007-case-flows.md`, `docs/threat-model.md` y `docs/specs/T5-ui-shell-requerimiento.md` (secciones 7 y 10).
**Fecha objetivo:** demo y repositorio público listos el 2026-11-03 (cierre de UNICEF: 2026-11-04, 11:59 p. m. CET). Si el tiempo aprieta, el orden de prioridad es: 7a, 7b, 7c, 7d (sección 9). El presupuesto de rendimiento y la prueba offline **no** se recortan.
**Auditoría posterior:** el código lo revisará una persona y otro agente. Comenta en español la lógica de seguridad y la no obvia, como en T3 a T6.
**Modelo de trabajo:** pasos cortos, un archivo a la vez, y ejecuta las pruebas después de cada paso. **Antes de usar cualquier opción de `vite-plugin-pwa`, Workbox o Playwright, confirma su nombre y comportamiento reales en la versión instalada (`node_modules/<paquete>/` o su documentación).** No supongas APIs. Si te falta contexto, vuelve a leer los archivos citados o pregunta. Empieza en modo plan: presenta el plan, supuestos y dudas, y espera aprobación antes de editar.

---

## 1. Objetivo

Convertir la aplicación de T1 a T6 en una PWA instalable que funcione **por completo sin red después de la primera carga en línea**, y demostrarlo con pruebas:

1. la primera visita con red descarga y guarda en caché el cascarón de la app,
2. a partir de ahí la app abre, desbloquea y ejecuta el flujo completo (TR-001 §1) con el teléfono en modo avión,
3. se puede instalar en la pantalla de inicio con un nombre y un ícono **neutrales**,
4. el JavaScript inicial se mantiene dentro del presupuesto de TR-001 §5 (≤ 250 KB gzip) y esto se verifica en CI,
5. cuando hay una versión nueva, la app la ofrece **sin recargar nunca durante un trabajo en curso**.

Escenario de amenaza (el mismo de T3 a T6): alguien hostil con acceso al teléfono. Ante cualquier duda, falla hacia el lado seguro. Dos riesgos nuevos de T7: (a) el nombre y el ícono instalados delatan la app en la pantalla de inicio y en el conmutador de apps; (b) una caché mal configurada podría guardar contenido que no debe.

---

## 2. Reglas no negociables

Rigen todas las de `AGENTS.md`, T3, T4, T5 y T6. Además, para esta tarea:

1. **El service worker solo guarda el cascarón de la app.** Precaché de los archivos que genera el build. **Sin `runtimeCaching`, sin `fetch` handlers propios, sin cachear respuestas de red en tiempo de ejecución.** En v1 no existe ninguna petición de datos de casos a la red; aun así, la caché nunca debe contener datos de casos, el PIN ni texto clínico del usuario (`AGENTS.md` regla 2).
2. **Sin Background Sync, Periodic Sync, Push ni notificaciones.** No los registres ni los declares en el manifiesto (TR-001 §4).
3. **No modifiques la CSP** de `index.html` ni la relajes. Con `default-src 'self'`, `worker-src` y `manifest-src` caen en `'self'`, así que no debería hacer falta. Si algo parece exigir un cambio, **detente y pregunta**.
4. **No modifiques** `apps/web/src/crypto/`, las constantes de PBKDF2, la lógica de bloqueo automático ni la de salida rápida de T5. Puedes **llamar** a la API pública de `vault`/`keyring` para leer el estado de bloqueo.
5. **Cero red de terceros.** Nada de CDN para Workbox: el runtime de Workbox va dentro del propio `sw.js`. Sin fuentes remotas, sin analítica, sin reportes de errores.
6. **Una actualización nunca descarta trabajo.** La nueva versión solo se activa con la bóveda **bloqueada** y por una acción explícita de la persona. Prohibidos `skipWaiting` automático y recargas automáticas.
7. **El manifiesto no revela el propósito de la app.** Sin `description`, sin palabras como violencia, mujer, riesgo, tamizaje o salud mental, sin `shortcuts`, `screenshots`, `share_target`, `file_handlers`, `protocol_handlers`, `related_applications` ni `categories`.
8. **Dependencias:** solo las pre-aprobadas en `AGENTS.md`: `vite-plugin-pwa`, `workbox-build` y `workbox-window` (pares exigidos por el plugin). `workbox-window` va en `dependencies` (queda dentro del bundle, como `react` y `dexie`); `vite-plugin-pwa` y `workbox-build`, en `devDependencies`. Para cualquier otra, detente y pregunta. Consulta la decisión D10 sobre la licencia de `caniuse-lite`.
9. **Sin `any`, sin `@ts-ignore`, sin `eslint-disable`.** Nunca desactives una prueba ni una regla para que algo pase.
10. **Textos de UI solo en `es.json` y `en.json`**, con exactamente las mismas claves. No muestres `error.message` al usuario.
11. **Datos sintéticos únicamente.** Las pruebas offline usan el PIN sintético de `e2e/helpers.ts`.

---

## 3. Alcance

### Incluye

- Plugin `vite-plugin-pwa` con service worker generado (`generateSW`), sin código propio de service worker.
- Manifiesto web generado por una función pura y probada; nombre corto, nombre largo y base de la URL configurables en tiempo de build (`VITE_APP_NAME`, `VITE_APP_SHORT_NAME`, `VITE_BASE_PATH`).
- Íconos neutrales (PNG 192, 512, 512 *maskable* y 180 para iOS) y su script de generación.
- Registro del service worker y módulo de estado: «listo sin conexión» y «actualización disponible».
- Aviso mínimo de actualización en la pantalla de desbloqueo y en Ajustes, y un indicador de «listo sin conexión» en Ajustes.
- Pruebas: unitarias (manifiesto, estado de registro), e2e offline y de instalabilidad con Playwright, auditoría del build y presupuesto en CI.
- Medición de rendimiento con perfil limitado (solo informativa, no bloquea CI).
- Documentación (sección 8).

### No incluye (no lo construyas)

| Fuera de T7 | Dónde va |
|---|---|
| Backend, sincronización, DHIS2, tablero público | TR-002 |
| Botón propio de «Instalar app» (`beforeinstallprompt`) | Decisión D8: se documenta la instalación manual |
| Notificaciones, Push, Background Sync | Fuera de v1 |
| Cambio de CSP, cabeceras HTTP del servidor | Se documentan (D9); no se implementan |
| Estrategias de caché en tiempo de ejecución, caché de datos | Prohibido en v1 |
| Pausar y reanudar un tamizaje cifrado | TR-002 (ADR-0007) |
| Datos de demostración y guion | T9 |
| README completo, modelo de amenazas completo | T8 (aquí solo se actualiza lo que cambia T7) |

---

## 4. Estado actual del repositorio (leído en el código adjunto; reconfírmalo antes de actuar)

| Hallazgo | Consecuencia para T7 |
|---|---|
| `apps/web/vite.config.ts` solo define `build.target` y `test.include`. No hay plugin PWA. `package.json` no lista `vite-plugin-pwa`, `workbox-build` ni `workbox-window`. | Hay que instalarlos y actualizar `package-lock.json`. |
| No existe `apps/web/public/`. `index.html` no tiene `<link rel="manifest">`, ni `theme-color`, ni `<link rel="icon">`. | Crear `public/icons/` y enlazar lo necesario. Sin favicon, Chromium puede pedir `/favicon.ico` y generar un error de consola que **haría fallar el fixture e2e**. |
| `index.html` enlaza los CSS desde `/src/styles/*.css` y la prueba `src/styles/__tests__/indexHtml.test.ts` fija esa lista y exige que la CSP no contenga `'unsafe-inline'`. | No romper esa prueba; ampliarla para el manifiesto y los metadatos nuevos. |
| `apps/web/dist/` incluido en el adjunto: `index-*.js` 403.529 bytes (≈ 124.992 bytes ≈ 122 KB con `gzip` nivel 6) y `index-*.css` 5.852 bytes. `dist/` está en `.gitignore`, así que puede estar desactualizado. | Línea base orientativa: el margen frente a 250 KB es amplio, pero **debes medir de nuevo** con `npm run build`. Workbox y el registro añadirán unos pocos KB. |
| `playwright.config.ts` compila y sirve con `vite preview` en `127.0.0.1:4173`; `e2e/fixtures.ts` falla si hay violaciones de CSP, errores de consola, errores de página o peticiones fuera de ese origen. | La prueba offline hereda esas vigilancias. Un fallo al registrar el service worker romperá la prueba, y es lo deseado. |
| `vitest` solo incluye `src/**/*.test.ts`. `tsconfig.json` de `apps/web` lista `src`, `e2e`, `vite.config.ts` y `playwright.config.ts`. | Pon el código testeable bajo `src/pwa/`. Si necesitas incluir otro archivo en `tsconfig`, hazlo de forma mínima. |
| `tsconfig` usa `"types": ["vite/client", "node"]`. | Hay que añadir los tipos de `virtual:pwa-register` (`vite-plugin-pwa/client`). |
| `requestPersistentStorage()` y el aviso de persistencia ya existen (T5-11). | No se reimplementan. Solo se documentan y se prueban junto con la instalación. |
| `.github/workflows/ci.yml`: job `verify` (lint, typecheck, test, build, licenses) y job `e2e` (Chromium). | Añadir el paso `npm run budget` tras el build en `verify`. El job `e2e` ya ejecutará los tests nuevos. |
| `scripts/check-licenses.mjs` solo admite 0BSD, Apache-2.0, BlueOak-1.0.0, BSD-2/3-Clause, CC0-1.0, ISC, MIT, MIT-0, Unlicense y Zlib. | En una instalación limpia aparte, `vite-plugin-pwa@2.0.0` + `workbox-build@7.4.1` + `workbox-window@7.4.1` traen 333 paquetes y **solo `caniuse-lite` (CC-BY-4.0) no está en la lista**. Ver D10. Confírmalo con `npm run licenses` en el repo real. |
| `vite-plugin-pwa@2.0.0` declara soporte para Vite `^7.0.0` y exige `workbox-build` y `workbox-window` `^7.4.1` como pares. | Compatible con el Vite 7 del proyecto. Verifica con `npm ls` tras instalar. |

---

## 5. Decisiones (usa el valor por defecto y regístralo en el ADR-0008; una persona puede cambiarlo)

| ID | Decisión | Valor por defecto |
|---|---|---|
| **D1** | Cómo generar el service worker. | `vite-plugin-pwa` con `strategies: 'generateSW'` y `workbox.inlineWorkboxRuntime: true`. **Sin archivo de service worker escrito a mano**: menos superficie de auditoría. `devOptions.enabled: false` (el SW no corre en `npm run dev`; se verifica en `preview`). |
| **D2** | Registro y actualización. | `registerType: 'prompt'`, `injectRegister: false`, registro desde un módulo propio con `virtual:pwa-register`, `skipWaiting: false`, `clientsClaim: false`, `cleanupOutdatedCaches: true`. **Sin sondeo periódico** de actualizaciones: el navegador ya busca una versión nueva en cada navegación. |
| **D3** | Qué se precachea. | Todo lo que emite el build: HTML, JS, CSS, íconos y `manifest.webmanifest`. Sin mapas de fuentes (`build.sourcemap` sigue en `false`). `runtimeCaching: []`. `navigateFallback` a `index.html` (el router es en memoria y la URL siempre es la raíz). El contenido de `content/` ya viaja dentro del JS (T6, D4), no se cachea aparte. |
| **D4** | Nombre, íconos y base. | `VITE_APP_NAME` (ya existe, por defecto `SaviaTech`) para `name`; `VITE_APP_SHORT_NAME` nuevo (por defecto, los primeros 12 caracteres de `VITE_APP_NAME`); `VITE_BASE_PATH` nuevo (por defecto `/`) para alojar bajo una subruta. El build **falla** si el nombre está vacío o supera 45 caracteres. Los íconos son archivos de `apps/web/public/icons/`: un despliegue neutral los reemplaza antes de compilar. `id`, `start_url` y `scope` salen de la base. El manifiesto no cambia tras la instalación (README, ya documentado). |
| **D5** | Íconos por defecto. | Diseño **neutral y geométrico** (por ejemplo, un cuadrado redondeado con un glifo simple tipo bloc de notas). Sin corazones, escudos, siluetas de mujer, símbolos de ayuda ni texto con el nombre de la app. Se generan desde un SVG fuente con `scripts/generate-icons.mjs`, usando el Chromium de Playwright (ya instalado), y se **commitean** los PNG. El diseño final lo aprueba una persona. |
| **D6** | Presupuesto de rendimiento. | Archivo `apps/web/bundle-budget.json` con los valores de la sección 6.5, verificado por `npm run budget` en CI. Cambiarlo requiere una línea en el ADR y revisión humana. |
| **D7** | Indicadores en la UI. | Mínimos: (a) en Ajustes, una línea «Lista para usar sin conexión» cuando el precaché terminó; (b) aviso de actualización disponible. Texto genérico, nada sensible. |
| **D8** | Instalación. | Sin botón propio. El README explica la instalación manual (Chrome Android: menú → «Instalar app»; iOS Safari: Compartir → «Añadir a pantalla de inicio»). |
| **D9** | Cabeceras de hosting. | No se implementan (el hosting estático puede no permitirlas) pero se **documentan**: HTTPS obligatorio; `Cache-Control: no-cache` para `index.html`, `sw.js` y `manifest.webmanifest`; una CSP en cabecera para `sw.js` equivalente a la del `index.html`. |
| **D10** | Licencia de `caniuse-lite` (CC-BY-4.0). | Es un dato usado solo en tiempo de build por la cadena de Workbox; **no se incluye en el bundle**. Propuesta: una excepción **nominal** en `scripts/check-licenses.mjs` (solo ese paquete, con comentario y nota en el ADR). **Necesita decisión humana: no modifiques el script sin aprobación.** Si no se aprueba, detente y pregunta por la alternativa. |
| **D11** | Pruebas de actualización. | Pruebas unitarias del módulo de estado y una **verificación manual** documentada (sección 7, T7-16). Una prueba e2e con dos builds queda fuera por costo frente a la fecha límite; se anota como pendiente en el ADR. |
| **D12** | Medición con perfil limitado. | Informativa (`e2e/perf.spec.ts`, solo con `PERF=1`, fuera de CI). Estrangulamiento de CPU y red por CDP en Chromium. No es una prueba de un teléfono real y no sustituye la medición manual de TR-001 §8. |

---

## 6. Diseño

### 6.1 Archivos nuevos y modificados

```
apps/web/
  vite.config.ts                  # modificado: plugin PWA, loadEnv, base, manifiesto
  index.html                      # modificado: icon, apple-touch-icon, theme-color (claro/oscuro)
  bundle-budget.json              # nuevo: límites (6.5)
  public/icons/                   # nuevo: icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, icon.svg
  src/pwa/
    manifest.ts                   # función pura buildManifest(); la importa vite.config.ts
    swStatus.ts                   # estado: unsupported | registering | offlineReady | updateAvailable | error
    registerServiceWorker.ts      # envoltura delgada de virtual:pwa-register (solo en producción)
    __tests__/manifest.test.ts
    __tests__/swStatus.test.ts
  src/ui/components/UpdateNotice.tsx
  src/ui/components/OfflineReadyStatus.tsx
  src/vite-env.d.ts               # modificado: VITE_APP_SHORT_NAME, VITE_BASE_PATH, tipos de virtual:pwa-register
  src/main.tsx                    # modificado: registrar tras createApp()
  src/i18n/es.json, en.json       # modificado: claves nuevas con paridad
  e2e/offline.spec.ts             # nuevo
  e2e/installability.spec.ts      # nuevo
  e2e/perf.spec.ts                # nuevo (solo PERF=1)
scripts/
  check-budget.mjs                # nuevo: presupuesto y auditoría de la salida del build
  generate-icons.mjs              # nuevo: SVG → PNG con Playwright
docs/adr/0008-pwa-offline.md
```

Confirma en `Shell.tsx`, `PinUnlockScreen.tsx` y `SettingsScreen.tsx` cómo se enchufan los componentes antes de tocarlos.

### 6.2 Configuración del plugin (esqueleto orientativo; verifica los nombres de opciones en la versión instalada)

```ts
// vite.config.ts (esqueleto, no copiar sin confirmar las opciones reales)
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
});
```

Comprobaciones tras compilar (parte de `npm run budget`, 6.5): `dist/index.html` contiene **exactamente un** `<link rel="manifest">` y ningún script ni estilo en línea; `dist/sw.js` existe y es un único archivo; la lista de precaché no tiene URLs absolutas ni de otros orígenes.

### 6.3 Manifiesto (`src/pwa/manifest.ts`, función pura con pruebas)

| Campo | Valor |
|---|---|
| `name` / `short_name` | `VITE_APP_NAME` / `VITE_APP_SHORT_NAME` |
| `id`, `start_url`, `scope` | Derivados de la base (`/` por defecto) |
| `display` | `standalone` |
| `lang` | `es` |
| `background_color` / `theme_color` | Valores de `--color-bg` en `tokens.css` (modo claro). En `index.html`, dos `<meta name="theme-color">` con `media="(prefers-color-scheme: dark)"` usando el valor oscuro. Confirma los valores leyendo `tokens.css`. |
| `icons` | 192 y 512 (`purpose: any`) y 512 `maskable`, relativos a la base |
| Ausentes | `description`, `categories`, `shortcuts`, `screenshots`, `share_target`, `file_handlers`, `protocol_handlers`, `related_applications`, `orientation` |

Pruebas unitarias del manifiesto: valores por defecto; nombre personalizado; base con subruta; error por nombre vacío o demasiado largo; **ausencia de los campos prohibidos**; **ninguna palabra de una lista de términos sensibles** (violencia, mujer, riesgo, tamizaje, salud mental y sus equivalentes en inglés) en ningún valor de texto.

### 6.4 Registro y actualización

- `registerServiceWorker.ts` solo registra si `import.meta.env.PROD` y `'serviceWorker' in navigator`. No hay efectos al importar: `main.tsx` lo llama una vez, tras `createApp()` y tras el evento `load`, para no competir con el arranque.
- `swStatus.ts` sigue el patrón del repo (`createX(deps)`, sin DOM): recibe una función de registro inyectable y expone `getState()`, `subscribe()` y `applyUpdate()`. Es testeable sin navegador.
- **Regla de aplicación:** `applyUpdate()` solo actúa si `keyring.getState() !== 'unlocked'`; si la bóveda está desbloqueada no hace nada y devuelve un resultado tipado.
- **UI:** `UpdateNotice` aparece (1) en la pantalla de desbloqueo, con botón «Actualizar» activo; y (2) en Ajustes, **sin botón**, con el texto «Se aplicará al bloquear». `OfflineReadyStatus` aparece en Ajustes. Ambos respetan i18n, foco visible y objetivos de 44 px; **sin `style=`**.
- Un fallo de registro cae a estado `error`: la app sigue funcionando en línea y Ajustes muestra «Sin modo sin conexión». No se muestra `error.message`.
- Un bloqueo, la salida rápida o el cierre de la app no deben depender de este módulo.

### 6.5 Presupuesto y auditoría del build (`scripts/check-budget.mjs`, `npm run budget`)

Se ejecuta **después** de `npm run build`. Lee `apps/web/dist/` y `apps/web/bundle-budget.json`. Mide con `zlib.gzipSync` nivel 9 (determinista). La transferencia real con Brotli será menor; se reporta como dato informativo, no como límite.

| Métrica | Límite duro (falla) | Aviso (≥ 80 %) |
|---|---|---|
| JS inicial gzip = suma de los scripts de `dist/index.html` más sus `modulepreload`, **sin** chunks diferidos | **250 KB** (TR-001 §5) | 200 KB |
| CSS inicial gzip | 30 KB | 24 KB |
| `index.html` sin comprimir | 4 KB | 3,2 KB |
| `sw.js` sin comprimir | 40 KB | 32 KB (confirma con la línea base medida y ajusta con una nota en el ADR) |
| Precaché total sin comprimir (todas las entradas) | 1 MiB | 0,8 MiB |

Salida: tabla con el tamaño real, el límite y el margen de cada métrica; código de salida distinto de cero si algo supera el límite duro.

La misma ejecución **audita la salida** y falla si: falta `sw.js` o `manifest.webmanifest`; hay más o menos de un `<link rel="manifest">`; `index.html` tiene `<script>` o `<style>` en línea o `style=`; `sw.js` contiene URLs `http(s)://` absolutas (si el runtime de Workbox incluye alguna constante inocua, añádela a una lista permitida comentada); el precaché lista algo que no sea del build; el manifiesto incluye campos prohibidos (6.3); falta alguno de los íconos declarados o su tamaño real no coincide.

### 6.6 Pruebas e2e

**Preparación común.** Las pruebas corren sobre el build servido por `vite preview` (ya lo hace `playwright.config.ts`). Reutiliza `e2e/helpers.ts` y el fixture de `e2e/fixtures.ts`. Nunca dependas de `waitForTimeout`; usa `expect.poll` o eventos.

**Cómo dejar la app lista antes de cortar la red:**

1. Visita `/` con red y espera `navigator.serviceWorker.ready`.
2. Espera con `expect.poll` a que exista una caché `workbox-precache*` que contenga todos los archivos esperados (compara con la lista que genera el build, leída desde `dist/` con `node:fs`).
3. Recarga una vez con red para que la página quede **controlada** por el service worker (`clientsClaim` está desactivado; en uso real basta con la siguiente navegación).
4. Solo entonces `context.setOffline(true)`.

**`e2e/offline.spec.ts`:**

| Escenario | Qué comprueba |
|---|---|
| O1 Instalación del SW | Registrado, activado, controla la página; el precaché completo contiene todos los archivos del build. |
| O2 Arranque en frío sin red | Tras cortar la red, una página nueva del mismo contexto carga y muestra la pantalla de PIN. |
| O3 Flujo completo sin red | Con la bóveda creada en línea y la red cortada: desbloquear → nuevo caso → consentimiento → tamizaje con ítem de seguridad → alerta → resultado con cambio de banda y justificación → guardar → ruta de remisión → salida rápida → pantalla neutral → bloqueo. Reutiliza la lógica de `flows.spec.ts` sin duplicar copiando selectores frágiles. |
| O4 Primer uso sin red | Tras la instalación del SW y con la red cortada, crear el PIN y la bóveda desde cero y llegar a Inicio. |
| O5 Auditoría de cachés | Tras O3: `caches.keys()` solo contiene cachés de precaché de Workbox; todas las URLs son del mismo origen y están en la lista del build; **ninguna** respuesta cacheada contiene el código del caso, texto de respuestas ni el PIN; `localStorage` solo tiene la clave de ajustes y `sessionStorage` está vacío. |
| O6 Sin red de terceros | El fixture ya lo vigila: cero peticiones fuera del origen, cero violaciones de CSP, cero errores de consola. |

**`e2e/installability.spec.ts` (solo Chromium, por CDP):** usa `context.newCDPSession(page)`; `Page.getInstallabilityErrors` devuelve una lista vacía; `Page.getAppManifest` devuelve el manifiesto esperado (nombre, `display`, íconos); cada ícono declarado responde 200 y es PNG; `index.html` tiene los metadatos de la sección 6.1.

**`e2e/perf.spec.ts` (solo con `PERF=1`, informativo):** con `Emulation.setCPUThrottlingRate` (4× y 6×) y `Network.emulateNetworkConditions` (perfil «Slow 4G»), mide el tiempo hasta ver la pantalla de PIN en (a) primera carga sin caché y (b) carga posterior servida por el service worker. Imprime la tabla con `test.info().annotations` (no con `console`). **Excluye PBKDF2**: ese costo se mide aparte en el teléfono real (T3/T4/T5 ya lo piden). En `playwright.config.ts`, ignora este archivo salvo con `PERF=1`.

### 6.7 Prueba en un teléfono real

El service worker **solo se registra en contextos seguros**: HTTPS o `localhost`. Abrir `http://192.168.x.x:4173` desde el teléfono **no** funciona. Opciones, en orden de preferencia: (1) un alojamiento HTTPS estático para la demo; (2) `adb reverse tcp:4173 tcp:4173` con depuración USB y abrir `http://localhost:4173` en el teléfono. Documenta la opción usada. La verificación manual de TR-001 §8 (Android de gama baja, modo avión) se hace con esta instalación; **no la marques como hecha si no se hizo**.

---

## 7. Criterios de aceptación

| ID | Criterio |
|---|---|
| T7-01 | `vite-plugin-pwa`, `workbox-build` y `workbox-window` instalados y fijados por `package-lock.json`; ninguna otra dependencia nueva; `npm run licenses` pasa (con la decisión D10 resuelta por una persona). |
| T7-02 | `npm run build` genera `dist/sw.js` (un solo archivo, runtime de Workbox embebido) y `dist/manifest.webmanifest`; `dist/index.html` tiene un único `<link rel="manifest">`. |
| T7-03 | La CSP de `index.html` no cambia; no hay `unsafe-inline`; `indexHtml.test.ts` sigue pasando y cubre los metadatos nuevos. |
| T7-04 | El manifiesto cumple 6.3: nombre y nombre corto configurables, base configurable, íconos 192/512/maskable, y **sin** los campos prohibidos ni palabras sensibles (pruebas unitarias). |
| T7-05 | El build falla con nombre vacío o de más de 45 caracteres. |
| T7-06 | El precaché solo contiene archivos del build; `runtimeCaching` está vacío; no hay `fetch` handlers propios (auditoría del build + O5). |
| T7-07 | O1: el service worker se registra, se activa y controla la página tras la primera carga en línea. |
| T7-08 | O2 y O3: con el contexto sin red, la app arranca y completa el flujo entero de TR-001 §1 hasta la salida rápida. |
| T7-09 | O4: la bóveda se puede crear sin red tras la instalación. |
| T7-10 | O5: tras el flujo, las cachés no contienen datos de casos ni el PIN; `localStorage` solo tiene los ajustes. |
| T7-11 | O6: cero violaciones de CSP, errores de consola y peticiones externas en todas las pruebas nuevas. |
| T7-12 | Instalabilidad: `Page.getInstallabilityErrors` vacío y manifiesto leído por CDP según lo esperado. |
| T7-13 | Presupuesto: `npm run budget` pasa en CI; JS inicial ≤ 250 KB gzip; el tamaño real y el margen se reportan en el ADR y en la salida final. |
| T7-14 | Actualización: `swStatus` pasa a `updateAvailable` cuando hay un SW en espera; `applyUpdate()` **no hace nada** con la bóveda desbloqueada y sí con ella bloqueada (pruebas unitarias). Nunca hay `skipWaiting` ni recarga automáticos. |
| T7-15 | `UpdateNotice` y `OfflineReadyStatus` cumplen i18n con paridad es/en, foco visible, objetivos ≥ 44 px, contraste AA en claro y oscuro, y sin `style=`. |
| T7-16 | Verificación manual de la actualización, documentada y ejecutada: compilar v1, servir, cargar; cambiar un texto, recompilar, recargar → aparece el aviso; con la bóveda desbloqueada no hay botón; bloquear y pulsar «Actualizar» → carga la v2 y los datos del caso siguen ahí. Se anota el resultado real. |
| T7-17 | Si el registro del service worker falla, la app sigue funcionando en línea y Ajustes lo indica (prueba unitaria de `swStatus`). |
| T7-18 | Las pruebas de T1 a T6 siguen pasando sin modificarlas, salvo la ampliación de `indexHtml.test.ts`. |
| T7-19 | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run budget`, `npm run licenses` y `npm run e2e` pasan en CI. Se reporta el resultado real. |
| T7-20 | Pendiente de medición manual (no cuenta como hecho hasta registrar modelo y resultado en el README): arranque, flujo completo y modo avión en un Android de gama baja con la app instalada. |

---

## 8. Documentación que debe actualizar T7

- `docs/adr/0008-pwa-offline.md` (corto, en inglés): decisiones D1 a D12; por qué solo precaché y sin `runtimeCaching`; por qué `prompt` y no actualización automática (el estado en curso es volátil por diseño, ADR-0007); por qué los íconos y el nombre son neutrales; tamaños medidos; la excepción de `caniuse-lite` si se aprueba; lo que **no** se probó por e2e (actualización) y por qué.
- `docs/threat-model.md`: sección «Implemented PWA controls (T7)» y nuevos límites: el nombre y el ícono instalados son visibles en la pantalla de inicio y en el conmutador de apps (por eso son configurables); el precaché es visible en los datos del sitio del navegador (no contiene datos de casos); la caché y IndexedDB pueden ser desalojadas por el sistema (persistencia solicitada y advertida, T5); en iOS Safari, WebKit limita el almacenamiento de sitios usados poco (**verifica el comportamiento vigente en la fuente de WebKit antes de afirmarlo**, y distingue entre Safari y app añadida a la pantalla de inicio); la actualización requiere conexión y una acción de la persona, de modo que puede haber teléfonos con una versión antigua.
- `README.md`: pasos de instalación manual (D8); cómo abrir la demo sin red; cómo reemplazar nombre e íconos para un despliegue neutral; requisito de HTTPS o `adb reverse` (6.7); cabeceras recomendadas (D9); tabla de mediciones; quitar «The PWA offline flow is T7» y la frase equivalente en la sección de pruebas.
- `AGENTS.md`: añadir `npm run budget` a los comandos; añadir `apps/web/src/pwa/` al árbol; la frase de `npm run e2e` pasa a «offline flow included»; las dependencias pre-aprobadas ya cubren este trabajo.
- `docs/specs/TR-001-vertical-slice.md`: estado «T7 implemented» (y «T8 next») en el encabezado y en §9.
- `.github/workflows/ci.yml`: paso `npm run budget` tras el build en el job `verify`.
- `SECURITY.md`: solo si cambia algo de lo declarado. El alcance ya menciona las cachés del service worker.
- `package.json` (raíz): script `budget`.

---

## 9. Forma de trabajo

1. **Línea base.** Antes de tocar nada: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run licenses`. Anota el tamaño real del JS y CSS (bruto y gzip). Reporta el resultado.
2. **Plan primero.** Presenta el plan, los supuestos, las preguntas abiertas y cómo verificarás cada criterio T7-01 a T7-20. **Espera aprobación.** Pregunta explícitamente por D4, D5, D8, D9 y D10, y por las preguntas de la sección 10.
3. Rama `feat/t7-pwa-offline`, con commits convencionales y descripciones en español (por ejemplo `feat(pwa): agrega el manifiesto web`).
4. Orden sugerido, con revisión humana entre pasos:
   - **7a:** dependencias, `src/pwa/manifest.ts` con pruebas, íconos y script de generación, `vite.config.ts`, `index.html`, `indexHtml.test.ts` (T7-01 a T7-05). Verifica con `npm run build` y revisando `dist/`.
   - **7b:** `swStatus.ts` con pruebas, `registerServiceWorker.ts`, `main.tsx`, `UpdateNotice`, `OfflineReadyStatus`, i18n (T7-14, T7-15, T7-17).
   - **7c:** `scripts/check-budget.mjs`, `bundle-budget.json`, script en el `package.json` raíz y paso de CI (T7-02, T7-06, T7-13).
   - **7d:** `offline.spec.ts`, `installability.spec.ts`, `perf.spec.ts` (T7-07 a T7-12).
   - **7e:** ADR-0008, threat model, README, AGENTS, TR-001, verificación manual de actualización (T7-16, T7-18, T7-19).
5. **Riesgos conocidos.**
   - El Service Worker **no corre** en `npm run dev` (D1). Verifica siempre con `npm run build && npm run preview`.
   - Si `context.setOffline` no corta las peticiones del propio service worker en la versión de Playwright instalada, **detente y propón** una alternativa (por ejemplo, detener el servidor de preview tras la instalación). No simules el resultado.
   - Si el runtime de Workbox embebido incluye `importScripts` o URLs externas, **detente y pregunta**. No relajes la auditoría.
   - Si una opción del plugin no existe con ese nombre en la versión instalada, usa la documentación de esa versión y registra la diferencia en el ADR.
6. Antes de dar la tarea por terminada, ejecuta lint, typecheck, tests, build, budget, licenses y e2e, y **reporta el resultado real**, también si algo falla.
7. Cierra con: qué cambió, tamaños medidos contra el presupuesto, qué te dejó dudas, qué necesita decisión humana y qué quedó sin medir (Android de gama baja, T7-20, y la actualización por e2e).

---

## 10. Preguntas abiertas para el equipo (respóndelas antes de 7a si es posible)

1. **¿Dónde se aloja la demo?** Define `VITE_BASE_PATH` (raíz o subruta) y si habrá HTTPS para la prueba en el teléfono. Si no se sabe, el defecto es `/` y se documenta.
2. **¿Se aprueba el diseño de ícono neutral (D5)** o hay un ícono propio que no revele el propósito de la app?
3. **¿Se aprueba la excepción nominal de `caniuse-lite` (D10)?**
4. **¿Nombre para la demo?** El defecto es `SaviaTech` (TR-001 §11). Un despliegue neutral puede usar otro.

---

## 11. Pendiente para otras tareas (no hacer ahora)

- T8: README completo con pasos de demostración, modelo de amenazas completo y revisión de ADRs.
- T9: datos sintéticos de demostración y guion de 2 minutos; el guion usa la app instalada y en modo avión (TR-001 §10).
- TR-002: sincronización, almacenamiento en el servidor, pausar y reanudar, y cualquier uso de cabeceras servidas por un backend propio.
- Más adelante: prueba e2e de actualización con dos builds, botón propio de instalación, bloqueo entre pestañas.
