# T6 — Flujos: caso, consentimiento, tamizaje, alerta de seguridad, resultado y remisión

**Versión:** 0.2 (reemplaza al borrador v0.1, que asumía un backend, XState, Zod y un registro de eventos que el proyecto no tiene en v1).
**Repositorio:** frontend (PWA, `proyecto-savia-tech-web`). El backend (NestJS, PostgreSQL) **no existe en este repositorio** y queda para TR-002, cuando haya financiación. No lo toques ni lo simules.
**Dependencias:** T1, T2, T3, T4 y T5 terminadas. Antes de empezar, lee `AGENTS.md`, `docs/specs/TR-001-vertical-slice.md` (secciones 3, 4, 6.1, 6.3, 7 y 8), `docs/adr/0002-instrument-validation.md`, `docs/adr/0005-case-storage.md`, `docs/adr/0006-ui-shell.md`, `docs/threat-model.md` y `docs/specs/T5-ui-shell-requerimiento.md` (secciones 5.4, 5.7 y 10).
**Referencia visual (solo flujo y textos, no código):** `docs/design/savia_demo.html`.
**Auditoría posterior:** el código lo revisará una persona y otro agente. Comenta en español la lógica de seguridad y la no obvia, como en T3, T4 y T5.
**Modelo de trabajo:** pasos cortos, un archivo a la vez, y ejecuta las pruebas después de cada paso. **Antes de usar cualquier función, tipo o ruta, ábrela y confirma su firma real.** No supongas APIs. Si te falta contexto, vuelve a leer los archivos citados o pregunta. Empieza en modo plan: presenta el plan, supuestos y dudas, y espera aprobación antes de editar.

---

## 1. Objetivo

Sobre el cascarón de T5 (PIN, bloqueo, salida rápida, i18n, ajustes) y el almacenamiento cifrado de T4, construir los flujos que usa una profesional de primera línea, con el teléfono incluso sin red:

1. ver la lista de casos,
2. crear un caso con código seudónimo,
3. registrar el consentimiento,
4. completar un tamizaje,
5. ver la alerta de seguridad cuando corresponda,
6. ver un resultado explicable y confirmar o cambiar el nivel con justificación,
7. ver la ruta de remisión local.

Todo se guarda cifrado en el dispositivo. El flujo completo debe poder mostrarse en menos de 2 minutos (guion de TR-001 §10).

Escenario de amenaza (el mismo de T3 a T5): alguien hostil con acceso al teléfono. Ante cualquier duda, falla hacia el lado seguro: bloquear, descartar el estado en curso y no mostrar contenido sensible.

**Qué es T6 y qué no.** T6 es solo el frontend y trabaja con **datos sintéticos y contenido de muestra (`SAMPLE`)**. No es todavía una herramienta para personas reales: eso exige validación de Trabajo Social, revisión legal y las funciones de TR-002 (sección 10).

---

## 2. Reglas no negociables

Rigen todas las de `AGENTS.md`, T3, T4 y T5. Además, para esta tarea:

1. **Datos sintéticos únicamente.** Todo caso que cree T6 se guarda con `synthetic: true`. La UI muestra un aviso permanente "Datos de demostración" mientras no exista una política para datos reales.
2. **Sin consentimiento no hay caso.** El repositorio exige `consent` al crear (`create` lo recibe en `NewCaseInput`), y la UI no avanza sin él. No existe un caso sin consentimiento en la base.
3. **El sistema sugiere; la profesional decide.** El nivel final y su justificación siempre se registran. Prohibido "diagnóstico" como afirmación en la UI (ver prueba en 6.1).
4. **Estado en curso solo en memoria y volátil.** Respuestas, nivel elegido y justificación sin guardar viven en estado de React y se registran en `volatileState` para que el bloqueo y la salida rápida los descarten. Nada en `localStorage`, `sessionStorage`, URL, `console.*`, atributos del DOM ni caché.
5. **La URL no cambia.** El router es en memoria (ADR-0006). Las rutas pueden llevar el `id` aleatorio del caso en memoria, nunca el código ni datos clínicos.
6. **Contenido clínico solo en `content/`.** Instrumento, bandas, umbral del ítem de seguridad, textos de consentimiento, protocolo de seguridad y rutas de remisión son archivos de datos versionados marcados `SAMPLE`. **No inventes contenido clínico, teléfonos, líneas de atención ni instituciones.** No copies el texto oficial del PHQ-9: usa ítems de muestra redactados con palabras propias (licencia por verificar).
7. **No modifiques** `apps/web/src/crypto/`, ni las constantes de PBKDF2, ni la lógica de bloqueo/salida rápida de T5. Si crees que hace falta, detente y pregunta.
8. **No cambies el modelo cifrado sin decisión humana.** `CasePayload`, `ConsentEntry` y `ScreeningEntry` (en `apps/web/src/model/case.ts`) tienen claves exactas validadas por `parseCasePayload`. T6 usa el modelo tal como está. Si una pantalla necesita un campo nuevo, detente y registra la duda (ver D2).
9. **No añadas dependencias.** Prohibidas XState, Zod, React Router, Testing Library, jsdom y cualquier librería de formularios o estado. Todo se escribe a mano. Para cualquier otra, detente y pregunta.
10. **CSP estricta** (`default-src 'self'; …`): sin `style={...}`, sin `<style>` ni scripts en línea. Todo el CSS va en los archivos de `apps/web/src/styles/`.
11. **Cero red de terceros**, sin fuentes remotas ni analítica. Pila de fuentes del sistema.
12. **Sin `any`, sin `@ts-ignore`, sin `eslint-disable`.** Nunca desactives una prueba ni una regla para que algo pase.
13. **Textos de UI solo en `es.json` y `en.json`**, con exactamente las mismas claves.
14. **No muestres `error.message`** al usuario: cada error se traduce a una clave de i18n.

---

## 3. Alcance

### Incluye

- Contenido de muestra en `content/` y su cargador con validación.
- Funciones puras para los estados de los flujos (sin dependencias).
- Pantallas: lista de casos, nuevo caso + consentimiento, tamizaje, alerta de seguridad, resultado, detalle del caso y ruta de remisión.
- Ampliación del router en memoria con las rutas nuevas.
- Textos en español e inglés.
- Pruebas unitarias, de integración con `fake-indexeddb` y e2e con Playwright.
- Documentación (sección 8).

### No incluye (no lo construyas)

| Fuera de T6 | Dónde va |
|---|---|
| Backend, API, PostgreSQL, NestJS, autenticación, Keycloak | TR-002 |
| Sincronización y registro de eventos de solo adición | TR-002 |
| Exportación a DHIS2 y tablero público de agregados | TR-002 |
| Revocación de consentimiento, borrado, anonimización | TR-002 (ver D6) |
| Alcances de consentimiento separados, protocolo de menores, rango de edad, territorio, motivo de contacto | TR-002 (ver D5) |
| Directorio de servicios con verificación y estados de remisión (`acordada`, `enviada`, `confirmada`) | TR-002 |
| Gestión de la alerta (confirmar, descartar, escalar) y aviso a la supervisora | TR-002 |
| NLP o cualquier IA, panel de supervisión, notificaciones | TR-002 |
| Varios instrumentos y selección por perfil | TR-002 |
| Service worker, manifiesto, prueba offline, presupuesto de rendimiento | T7 |
| Datos de demostración (semilla) y guion | T9 |
| Cambio de PIN desde la UI | decisión abierta D6 de T5 |

---

## 4. Decisiones (usa el valor por defecto y regístralo en el ADR-0007; una persona puede cambiarlo)

| ID | Decisión | Valor por defecto |
|---|---|---|
| **D1** | Cómo modelar los estados de los flujos sin XState. | **Funciones puras y reductores en TypeScript** en `apps/web/src/flows/`, sin React ni DOM. Cada transición inválida devuelve el mismo estado o un error tipado, nunca lanza al azar. |
| **D2** | Qué se guarda y cuándo. | El caso se crea **al aceptar el consentimiento** (`repository.create`). El tamizaje en curso vive solo en memoria. Se guarda un `ScreeningEntry` **una vez** (`repository.update`) cuando la profesional confirma el nivel final. Si se bloquea a mitad, **las respuestas se pierden** (decisión de seguridad; pausar y reanudar cifrado es TR-002). Un caso puede existir con 0 tamizajes. |
| **D3** | Cuándo aparece la alerta de seguridad. | **Al completar el tamizaje y antes del resultado**, como pide TR-001 F6. Mejora propuesta para decisión de Trabajo Social: mostrarla en el instante en que se responde el ítem de seguridad por encima del umbral. Implementa lo primero y deja la mejora anotada en el ADR. |
| **D4** | Cómo se cargan los archivos de `content/`. | Importación estática de JSON (`resolveJsonModule` ya está activo) desde un módulo `apps/web/src/content/`, que los **valida al arrancar**. El instrumento se valida con `validateInstrument` de `@saviatech/rules`; consentimiento y remisión, con validadores escritos a mano. Si falla, la app no permite crear tamizajes y muestra un error genérico traducido. |
| **D5** | Edad, menores y territorio. | **Fuera de v1.** El modelo no tiene esos campos. Consecuencia que debe constar en el ADR y en el modelo de amenazas: v1 no puede detectar que la persona es menor de edad, por eso solo admite datos sintéticos. Antes de cualquier piloto con personas reales hace falta el protocolo de menores y la revisión legal (obligación de reporte, Ley 1098 de 2006; datos sensibles, Ley 1581 de 2012). |
| **D6** | Revocación de consentimiento y borrado. | **No existen en v1** (ADR-0005). La pantalla de consentimiento no promete que se podrá revocar. Anótalo como limitación. |
| **D7** | Qué nivel decide la prioridad de la remisión. | Se usa el **nivel final** (`finalBand`, la decisión de la profesional) o cualquier `safetyAlert = true`. Las bandas que activan la ruta prioritaria las declara el archivo de remisión (`priorityBands`), no el código. |
| **D8** | Navegación. | Botón "Atrás" explícito en cada pantalla (ADR-0006). Sin atrás nativo. |
| **D9** | Lista de casos. | Orden por actualización (lo que da `list`), página de 20, botón "Ver más". Muestra el código y la fecha de actualización. Si `unreadableIds` no está vacío, avisa cuántos registros no se pudieron leer, sin mostrar ids. |

---

## 5. Diseño

### 5.1 Qué reemplaza al borrador v0.1

| Concepto del borrador v0.1 | Estado real en v1 |
|---|---|
| Monorepo pnpm, `packages/domain`, `packages/crypto`, `apps/api` | npm workspaces con solo `apps/web` y `packages/rules`. Cripto en `apps/web/src/crypto/`. Sin API. |
| XState, Zod, fast-check, Keycloak, NestJS, Testing Library | No están en el proyecto y no se pueden añadir sin pedirlo. Validación a mano, reductores puros, Vitest 3 y Playwright. |
| Registro de eventos con cadena de hashes y sincronización | Un agregado cifrado por caso (`CasePayload`). Los eventos llegan con TR-002. |
| Niveles `bajo/moderado/alto/crítico` | Las **bandas las define el instrumento** (`minimal`, `mild`, `moderate`, `moderately-severe`, `severe` en la muestra). |
| Alerta crítica / alta / informativa con gestión | Una **alerta de seguridad booleana** del ítem de seguridad (`hasSafetyAlert`, comparación estricta `>`). Se registra como `safetyAlert`. |
| Consentimiento con 4 alcances, revocable | Un consentimiento obligatorio con versión de texto y marca de tiempo. |
| Estados de remisión | Solo la **ruta sugerida** desde `content/`. Las remisiones no se guardan (ADR-0005). |
| Reglas con `rulesVersion` | Se guardan `instrumentId` e `instrumentVersion` en cada tamizaje. |

### 5.2 Mapa de los seis flujos en v1

| Flujo | Qué entra en T6 | Aplazado a TR-002 |
|---|---|---|
| **F1 Caso** | Código seudónimo aleatorio (lo genera el repositorio), lista, detalle. Sin nombre, documento ni dirección. | Edad, territorio, motivo, estados `borrador/abierto/cerrado`. |
| **F2 Consentimiento** | Texto por capas de `content/consent/` (resumen y ampliado), casilla obligatoria, versión y marca de tiempo. | Alcances separados, revocación, menores, audio o pictogramas. |
| **F3 Tamizaje** | Una pregunta por pantalla, progreso, atrás, no se finaliza con ítems vacíos, etiqueta SAMPLE y metadatos del instrumento. | Pausar y reanudar, varios instrumentos, selección por perfil. |
| **F4 Alerta** | Pantalla de protocolo de seguridad (texto de muestra) antes del resultado; la profesional debe pulsar "Entendido" para continuar. | Disparo inmediato por ítem (D3), gestión confirmar/descartar/escalar, aviso a supervisión. |
| **F5 Resultado** | Puntuación, banda, respuestas de valor 2 o más, lenguaje no diagnóstico, nivel final y justificación obligatoria si cambia. | Intervenciones sugeridas, observaciones de NLP. |
| **F6 Remisión** | Ruta desde `content/referral/` con ruta prioritaria primero (D7) y fecha de última verificación (placeholder). | Directorio por territorio, estados, recordatorios, datos compartidos con consentimiento. |

### 5.3 Estructura de archivos nuevos

```
content/
  instruments/phq9.sample.json        # instrumento de muestra (TR-001 §6.3)
  consent/consent.sample.json         # texto por capas es/en + versión
  referral/referral.sample.json       # rutas, prioridad, protocolo de seguridad (SAMPLE)
apps/web/src/
  content/
    index.ts                          # carga y expone contenido ya validado
    consent.ts                        # validador a mano del consentimiento
    referral.ts                       # validador a mano de la remisión
    __tests__/content.test.ts
  flows/
    newCaseFlow.ts                    # estado y reductor: consentimiento
    screeningFlow.ts                  # estado y reductor: preguntas → alerta → resultado
    buildScreeningEntry.ts            # función pura: estado final → ScreeningEntry
    __tests__/*.test.ts
  ui/screens/
    CaseListScreen.tsx
    NewCaseScreen.tsx                 # código + consentimiento
    CaseDetailScreen.tsx
    ScreeningScreen.tsx               # contiene los pasos: preguntas, alerta, resultado
    SafetyAlertScreen.tsx
    ResultScreen.tsx
    ReferralScreen.tsx
  ui/components/
    SampleBanner.tsx                  # aviso SAMPLE / datos de demostración
    ProgressBar.tsx
apps/web/e2e/flows.spec.ts
docs/adr/0007-case-flows.md
```

`HomeScreen.tsx` pasa a ser la lista de casos (o la envuelve). Confirma en `Shell.tsx` cómo se enchufan las pantallas antes de tocarlo.

### 5.4 Contenido de muestra

**Instrumento** (`content/instruments/phq9.sample.json`): sigue exactamente el formato de TR-001 §6.3, con `status: "SAMPLE"` y `licenceStatus: "to-verify"`. Redacta ítems abreviados con palabras propias (9 ítems, opciones 0 a 3, bandas 0-4, 5-9, 10-14, 15-19, 20-27, ítem de seguridad `index: 8`, `alertWhenAbove: 0`). Debe pasar `validateInstrument` sin errores.

**Consentimiento** (`content/consent/consent.sample.json`):

```json
{
  "version": "sample-1",
  "status": "SAMPLE",
  "languages": {
    "es": { "summary": ["línea 1", "línea 2", "línea 3"], "full": ["párrafo", "..."], "checkbox": "..." },
    "en": { "summary": ["line 1", "line 2", "line 3"], "full": ["paragraph", "..."], "checkbox": "..." }
  }
}
```

El resumen son exactamente 3 líneas. El texto debe decir con claridad que es una muestra y que la información se guarda cifrada en este dispositivo. **No incluyas promesas legales ni de revocación** (D5 y D6).

**Remisión y protocolo de seguridad** (`content/referral/referral.sample.json`):

```json
{
  "version": "sample-1",
  "status": "SAMPLE",
  "priorityBands": ["moderately-severe", "severe"],
  "safetyProtocol": { "es": ["paso 1", "paso 2"], "en": ["step 1", "step 2"] },
  "services": [
    {
      "id": "sample-priority",
      "priority": true,
      "type": "health",
      "name": { "es": "Servicio de muestra A", "en": "Sample service A" },
      "contact": "000-000-0000",
      "hours": { "es": "24 horas (muestra)", "en": "24 hours (sample)" },
      "lastVerified": "SAMPLE-DD-MM-AAAA"
    }
  ]
}
```

Ningún teléfono, línea ni institución reales. Todo marcado `SAMPLE`; la UI lo muestra de forma visible.

Los validadores de consentimiento y remisión siguen el estilo de ADR-0002: devuelven un resultado explícito (`ok`/`errors` con `path`), no lanzan por contenido inválido, y verifican que `es` y `en` tengan el mismo número de líneas y que `priorityBands` contenga solo ids de banda que existan en el instrumento.

### 5.5 Funciones puras de los flujos (D1)

**Nuevo caso** (`newCaseFlow.ts`): estados `consent-pending` → `consent-accepted`. La casilla activa el botón; sin ella, ninguna acción crea el caso.

**Tamizaje** (`screeningFlow.ts`):

```
questions ──(completar sin vacíos)──► [hasSafetyAlert?] ──sí──► safety-alert ──(Entendido)──► result
                                            └────────────────no────────────────────────────► result
result ──(guardar con nivel final válido)──► saved
```

```ts
// Forma orientativa; confirma contra los tipos reales de @saviatech/rules antes de usarla.
export type ScreeningStep = 'questions' | 'safety-alert' | 'result' | 'saved';

export interface ScreeningState {
  readonly step: ScreeningStep;
  readonly index: number;                      // pregunta visible
  readonly answers: readonly (number | null)[];
  readonly evaluation: ScreeningResult | null; // de evaluateScreening, al completar
  readonly finalBand: string | null;
  readonly justification: string;
}
```

Reglas del reductor:

- `answer(value)` solo acepta valores que estén en `optionValues` del instrumento.
- `back` nunca baja de la pregunta 0; conserva las respuestas.
- `finish` falla con ítems sin responder (usa `validateAnswers`). Si pasa, llama a `evaluateScreening` y fija `finalBand` igual a la banda calculada. Si `safetyAlert`, pasa a `safety-alert`; si no, a `result`.
- `acknowledgeAlert` es la única salida de `safety-alert`.
- `setFinalBand(id)` solo admite ids de banda del instrumento.
- `save` exige que, si `finalBand` difiere de `computedBand`, `justification.trim()` no esté vacío. Esta regla **también** la impone `parseCasePayload` (lanza `InvalidCaseDataError`); la UI debe prevenirla antes, no depender del error.

`buildScreeningEntry(instrument, state, nowIso)` devuelve un `ScreeningEntry` con: `instrumentId`, `instrumentVersion`, `answers`, `score`, `computedBand`, `finalBand`, `justification` (`null` si no cambió, texto recortado si cambió), `safetyAlert` y `timestamp` en UTC con `Z` (`new Date().toISOString()`). **La puntuación y la banda las calcula `@saviatech/rules`; el almacenamiento no las recalcula.**

### 5.6 Persistencia (usa solo la interfaz `CaseRepository`)

La UI no toca Dexie ni `CryptoKey`. Importa desde `storage/index.ts`.

```ts
// Al aceptar el consentimiento
const record = await repository.create({
  consent: { textVersion: consent.version, timestamp: new Date().toISOString() },
  synthetic: true,
});

// Al confirmar el nivel final
await repository.update(record.id, (current) => ({
  ...current,
  screenings: [...current.screenings, entry],
}));
```

- `update` no permite cambiar `code`, `createdAt` ni `consent`; el reductor de `updater` solo agrega al final de `screenings`.
- Maneja `VaultLockedError` (volver a la compuerta, que ya está bloqueada), `ConcurrentModificationError` (ofrecer reintentar), `InvalidCaseDataError` y `CorruptDataError` (mensaje traducido genérico). **Nunca muestres `error.message`.**
- **Resultados asíncronos tras un bloqueo.** Antes de aplicar la respuesta de cualquier operación del repositorio, compara el `epoch` que tenía el componente al iniciar con el actual del controlador de la bóveda (ADR-0006). Si cambió, descarta el resultado sin actualizar estado. Abre `vaultController.ts` y confirma cómo se expone el `epoch`.
- Evita doble envío: bloquea el botón "Guardar" mientras la operación está en curso.

### 5.7 Estado volátil y bloqueo

- Todo componente que guarde estado en curso (consentimiento pendiente, respuestas, justificación) registra su limpieza con `volatileState.register(clear)` al montarse y la anula al desmontarse.
- `clear` deja el estado en su valor inicial. El árbol protegido se desmonta con cada bloqueo (ADR-0006), así que esto es una segunda barrera.
- Tras bloqueo o salida rápida no queda texto sensible en el DOM (se comprueba en e2e).

### 5.8 Rutas (extiende `router/routes.ts`)

```ts
export type Route =
  | { readonly name: 'home' }                       // lista de casos
  | { readonly name: 'settings' }
  | { readonly name: 'new-case' }
  | { readonly name: 'case-detail'; readonly caseId: string }
  | { readonly name: 'screening'; readonly caseId: string }
  | { readonly name: 'referral'; readonly caseId: string };
```

`caseId` es el UUID aleatorio del repositorio, solo en memoria. Actualiza las pruebas del router. Los pasos de alerta y resultado son internos de `ScreeningScreen` (reductor), no rutas, para que el estado en curso no pueda reconstruirse desde el historial.

### 5.9 Pantallas

Todas: título `h1` con el foco al montarse (como en T5), etiquetas asociadas, foco visible, objetivos táctiles de al menos 44 px, contraste WCAG 2.1 AA en modo claro y oscuro, y el `SampleBanner` visible.

| Pantalla | Comportamiento |
|---|---|
| **Lista (`home`)** | Botón "Nuevo caso". Lista de casos (código y fecha de actualización formateada con `Intl.DateTimeFormat`, zona `America/Bogota`). Estado vacío con texto claro. "Ver más" si hay otra página. Aviso si `unreadableIds` no está vacío. |
| **Nuevo caso** | Muestra el consentimiento por capas: resumen de 3 líneas y botón para expandir el texto completo. Casilla obligatoria. Botón "Continuar" deshabilitado sin casilla. Al aceptar, crea el caso y navega a `screening`. El código seudónimo se muestra tras crear el caso (lo genera el repositorio). |
| **Tamizaje** | Una pregunta por pantalla en un `fieldset` con `legend` y opciones como radios. Barra de progreso con texto ("Pregunta 3 de 9"). Botones Atrás y Siguiente; "Finalizar" solo en la última. Cabecera con nombre del instrumento, versión y etiqueta SAMPLE. |
| **Alerta de seguridad** | Contenedor con `role="alert"` y foco en el título. Muestra el protocolo de seguridad de `content/` (muestra). Un único botón "Entendido" lleva al resultado. Sin cerrar por Esc ni clic fuera. |
| **Resultado** | Puntuación sobre el máximo, banda (etiqueta traducida con la clave `band.<id>`), lista "Qué pesó más" con las respuestas de valor 2 o más (texto del ítem y valor), y la frase de que la herramienta no diagnostica. Selector de nivel final (valor inicial = banda calculada). Campo de justificación, obligatorio si el nivel cambia, con error en `role="alert"`. Botón "Guardar". Tras guardar, navega al detalle del caso o a la remisión. |
| **Detalle de caso** | Código, fecha de creación, lista de tamizajes (fecha, banda final, indicador de alerta). Acciones: "Nuevo tamizaje" y "Ver ruta de remisión". |
| **Remisión** | Ruta del caso según el último tamizaje (D7): servicios prioritarios primero si aplica, luego el resto. Cada servicio con nombre, tipo, horario, contacto y "Última verificación" (placeholder). Aviso SAMPLE visible. Botón "Atrás". |

**Textos:**
- Claves nuevas con prefijos `cases.`, `newCase.`, `consent.`, `screening.`, `safety.`, `result.`, `band.`, `referral.`, `caseDetail.` y `sample.`.
- Lenguaje de "sugiere" y "se recomienda valorar". No uses "diagnóstico" como afirmación de lo que hace la herramienta.
- Añade una clave `band.<id>` por cada banda del instrumento, en ambos idiomas.

---

## 6. Pruebas

### 6.1 Unitarias (Vitest, entorno Node, sin DOM)

- **Contenido:** los tres JSON cargan y validan; instrumento con `validateInstrument`; `es` y `en` con igual número de líneas; `priorityBands` apunta a bandas existentes; un JSON inválido produce errores con `path`; cada banda del instrumento tiene su clave `band.<id>` en `es.json` y `en.json`.
- **`newCaseFlow`:** sin casilla no hay creación; con casilla sí.
- **`screeningFlow`:** respuesta fuera de `optionValues` rechazada; `back` en la pregunta 0; `finish` con ítem vacío falla; `finish` completo calcula puntuación y banda con `evaluateScreening`; alerta cuando el ítem de seguridad supera el umbral (comparación estricta); sin alerta en el umbral exacto; `acknowledgeAlert` es la única salida de `safety-alert`; `setFinalBand` rechaza ids inexistentes; `save` con banda cambiada y justificación vacía o de solo espacios falla; con justificación válida pasa.
- **`buildScreeningEntry`:** `justification` es `null` si no cambió; marca temporal UTC con `Z`; el resultado pasa `parseCasePayload` dentro de un caso válido.
- **Integración con `fake-indexeddb`:** crear caso → agregar tamizaje con `update` → `get` devuelve ambos; tras guardar, un volcado crudo de IndexedDB **no contiene** el código del caso, las respuestas ni la justificación en claro (como en T4, ahora con el flujo real).
- **Router:** rutas nuevas, `reset()` y `showNeutral()` las descartan, la URL no cambia.
- **Estáticas:** ningún `style={`, `localStorage`, `sessionStorage` ni `console.` nuevo en `src/` (salvo lo ya permitido en `settingsStore`); `es.json` y `en.json` con las mismas claves y sin cadenas vacías (extiende la prueba de T5); ningún valor de i18n contiene "diagnóstico"/"diagnosis" salvo la clave de la nota de que la herramienta no diagnostica.

### 6.2 e2e (Playwright, Chromium, sobre `vite preview` tras `vite build`)

Reutiliza `e2e/fixtures.ts` y `e2e/helpers.ts` (PIN sintético `135790`). En `flows.spec.ts`:

1. **Flujo completo sin alerta:** crear bóveda → nuevo caso → consentimiento → tamizaje con respuestas bajas → resultado → guardar sin cambios → detalle del caso muestra el tamizaje → remisión sin ruta prioritaria primero.
2. **Flujo con alerta:** respuesta en el ítem de seguridad por encima del umbral → aparece la alerta con `role="alert"` → solo "Entendido" continúa → resultado → remisión con la ruta prioritaria primero.
3. **Cambio de nivel:** cambiar el nivel sin justificación bloquea el guardado con error; con justificación guarda.
4. **Sin consentimiento no hay caso:** "Continuar" deshabilitado; la lista sigue vacía.
5. **Bloqueo a mitad de tamizaje:** al bloquear (botón Bloquear) y desbloquear de nuevo, la lista muestra el caso pero sin tamizaje nuevo, y no queda ninguna respuesta en el DOM.
6. **Salida rápida:** desde el resultado, un toque lleva a la pantalla neutral y el DOM no contiene el código del caso ni textos clínicos.
7. **Idioma:** cambiar a inglés a mitad del flujo traduce las pantallas sin perder las respuestas.
8. **CSP:** ninguna pantalla nueva genera violaciones de CSP (extiende `csp.spec.ts` si hace falta).

La prueba **offline** del flujo completo es de T7, no de T6.

---

## 7. Criterios de aceptación (todos verificables)

- [ ] `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run licenses` y `npm run e2e` pasan.
- [ ] Los tres archivos de `content/` existen, están marcados `SAMPLE` y validan al arrancar.
- [ ] El flujo completo (lista → caso → consentimiento → tamizaje → alerta si aplica → resultado → remisión) funciona en Chromium y queda cifrado en IndexedDB.
- [ ] No se puede crear un caso sin consentimiento ni guardar un nivel cambiado sin justificación.
- [ ] La alerta de seguridad aparece antes del resultado cuando el ítem supera el umbral y exige "Entendido".
- [ ] El volcado crudo de IndexedDB no contiene código, respuestas, bandas ni justificación en claro.
- [ ] Tras bloqueo o salida rápida no queda estado en curso ni texto sensible en el DOM.
- [ ] Un resultado asíncrono que llega después de un bloqueo se ignora (prueba que compara `epoch`).
- [ ] Todo caso creado tiene `synthetic: true` y la UI muestra el aviso de datos de demostración.
- [ ] Ninguna dependencia nueva en `package.json` ni en `package-lock.json`.
- [ ] `es.json` y `en.json` tienen las mismas claves; ninguna cadena sin traducir en pantalla.
- [ ] Cada pantalla nueva cumple las reglas de accesibilidad de la sección 5.9.

---

## 8. Documentación que debe actualizar T6

- **`docs/adr/0007-case-flows.md`:** decisiones D1 a D9, la mejora propuesta de D3, y las limitaciones conocidas (sin menores, sin revocación, respuestas perdidas al bloquear).
- **`docs/threat-model.md`:** nueva sección "Implemented flow controls (T6)" y nuevas limitaciones: v1 no detecta menores, no hay revocación ni borrado, respuestas en curso solo en memoria, la lista y las fechas de actualización son visibles (ADR-0005), la pantalla de alerta no se registra como gestionada.
- **`README.md`:** estado (T6 implementado), diseño de las pantallas, comandos sin cambios, aclaración de que sigue siendo solo frontend y solo datos sintéticos.
- **`docs/specs/TR-001-vertical-slice.md`:** cambia el estado a "T1–T6 implemented; T7 next".
- **`AGENTS.md`:** diseño de archivos con `content/`, `apps/web/src/content/` y `apps/web/src/flows/`.
- **Este archivo:** `docs/specs/T6-flujos-requerimiento.md`, tal cual, como registro de la tarea.

---

## 9. Forma de trabajo

1. Lee los documentos de la cabecera y confirma las firmas reales de `CaseRepository`, `evaluateScreening`, `validateAnswers`, `VaultController` (incluido `epoch`) y `VolatileStateRegistry`.
2. Presenta el plan, supuestos y dudas. Espera aprobación.
3. Orden sugerido, con una rama y una revisión por paso (`feat/t6-<slug>`):
   1. `content/` y su cargador con validación y pruebas.
   2. `flows/` (funciones puras) con pruebas.
   3. Rutas y lista de casos.
   4. Nuevo caso y consentimiento.
   5. Tamizaje.
   6. Alerta y resultado, con persistencia y manejo de `epoch`.
   7. Detalle de caso y remisión.
   8. e2e y documentación.
4. Tras cada paso: lint, typecheck, tests y build. Informa los resultados con honestidad.
5. Después de implementar la persistencia (paso 6), haz una revisión aparte en modo plan ("revisa errores, no cambies código") antes de seguir.
6. Cierra con: qué cambió, qué te dejó dudas, qué necesita una decisión humana (en particular D3, D5 y D7) y qué quedó sin medir (rendimiento en un Android de gama baja).

---

## 10. Pendiente para TR-002 (con la financiación de UNICEF; no hacer ahora)

**Plataforma**
- Backend de código abierto y autoalojable (NestJS, PostgreSQL), autenticación (OIDC/Keycloak) y roles `profesional`, `supervisora` y `admin`.
- Sincronización por **registro de eventos de solo adición**: `CASO_CREADO`, `CONSENTIMIENTO_OTORGADO`, `CRIBADO_COMPLETADO`, `ALERTA_GESTIONADA`, `RESULTADO_VALIDADO`, `DERIVACION_CREADA`, con `eventId` idempotente, cadena de hashes y dispositivo de origen. En iOS la sincronización se dispara al abrir la app (límite de Background Sync).
- Exportación agregada a DHIS2 en un entorno de prueba y tablero público solo con conteos anonimizados, con umbral mínimo por celda (por ejemplo, no publicar celdas menores de 5), solo para casos con consentimiento de compartir.

**Seguridad y privacidad**
- Alcances de consentimiento separados (cribar, guardar, compartir agregado, contacto de seguimiento) y **revocación** con borrado o anonimización. Opción de crypto-shredding (destruir la clave del caso) sujeta a validación legal.
- Protocolo de menores y campos de edad, territorio y motivo de contacto, con asesoría legal (Ley 1098 de 2006 y Ley 1581 de 2012).
- Custodia de claves en el servidor, protección contra reversión (rollback), notificaciones sin contenido sensible, cambio de PIN y frase de paso.

**Producto**
- Alerta disparada al responder el ítem de seguridad y gestión (confirmar, descartar, escalar) con aviso a supervisión.
- Pausar y reanudar tamizajes, varios instrumentos y selección por perfil (embarazo/posparto, adolescente, motivo de contacto), con licencias verificadas (EPDS, PHQ, GAD-7, preguntas de la OMS sobre violencia de pareja).
- Directorio de servicios por territorio con fecha de última verificación, estados de la remisión y recordatorios.
- Intervenciones sugeridas basadas en evidencia, revisadas por Trabajo Social y salud mental. Observaciones opcionales de NLP, sin cambiar nunca el nivel por sí solas.

**Decisiones humanas pendientes (no bloquean T6; sí el piloto)**

| # | Decisión | Responsable |
|---|---|---|
| H1 | Contenido clínico real: bandas, umbrales, texto de consentimiento, protocolo de seguridad | Trabajo Social + salud mental |
| H2 | Directorio y rutas de remisión reales del territorio piloto, con números verificados | Trabajo Social |
| H3 | Licencias de los instrumentos | Dirección técnica |
| H4 | Protocolo legal de menores y política de borrado | Abogado |
| H5 | Cuándo se muestra la alerta (al finalizar o al responder el ítem) | Trabajo Social (D3) |
| H6 | Política de datos reales y retirada del aviso de datos de demostración | Dirección del proyecto |
