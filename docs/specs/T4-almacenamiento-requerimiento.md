# T4 — Capa de almacenamiento: Dexie + repositorio cifrado de casos

**Repositorio:** frontend (PWA, `proyecto-savia-tech-web`). El backend/API NO se toca en esta tarea.
**Dependencias:** T1, T2 y T3 terminadas. Antes de empezar, lee `AGENTS.md`, `docs/specs/TR-001-vertical-slice.md` (secciones 6.1, 7 y 8), `docs/adr/0003-local-encryption.md`, `apps/web/src/crypto/README.md` y el código de `apps/web/src/crypto/` y `apps/web/src/storage/`. Adapta nombres, rutas y tipos a lo que ya existe. No dupliques módulos.
**Auditoría posterior:** el código será revisado línea por línea por una persona y por otro agente. Comenta la lógica de seguridad en español, como en T3.

---

## 1. Objetivo

Que cada caso se guarde en IndexedDB solo como registro cifrado, y que la app acceda a los casos únicamente a través de un repositorio que usa la sesión de clave del llavero de T3. La UI (T5/T6) nunca toca Dexie ni `crypto` directamente.

Escenario de amenaza (igual que T3): alguien con el teléfono desbloqueado abre las herramientas de desarrollo y lee IndexedDB. Debe ver solo `id`, `v`, `iv`, `ct` y `actualizadoEn`.

## 2. Reglas no negociables

Rigen todas las de `AGENTS.md` y las de T3. Además, para esta tarea:

1. **Datos sintéticos únicamente** en código, pruebas y ejemplos.
2. Ningún dato de caso en `localStorage`, `sessionStorage`, cookies, URLs, `console.*`, logs ni cachés del service worker.
3. El repositorio obtiene la clave **solo** con `keyring.withDataKey(...)`. Nunca guarda la sesión ni la clave en una variable que sobreviva a la operación.
4. **No añadas dependencias.** Dexie y `fake-indexeddb` ya están. Si crees que falta algo, detente y pregunta.
5. **No amplíes el alcance** (ver sección 3). Si algo del spec es ambiguo o choca con el código, pregunta antes de decidir.
6. No bajes iteraciones PBKDF2 ni modifiques `crypto/` salvo un cambio mínimo y justificado que apruebe una persona.
7. Escribe las pruebas antes o junto con el código. Sin pruebas pasando, la tarea no está terminada.

## 3. Alcance

**Entra en T4:**

- Migración de Dexie a la versión 2 con la tabla `cases`.
- Tipos del modelo del caso y validación en tiempo de ejecución de lo que sale del descifrado.
- Generador del código seudónimo del caso.
- Repositorio de casos: crear, obtener, listar (paginado) y actualizar.
- Petición de almacenamiento persistente y estimación de espacio.
- Pruebas, ADR y actualización de documentos.

**No entra en T4** (no lo construyas; TR-001 sección 4 lo excluye o pertenece a TR-002):

- Backend, sincronización, outbox de eventos, `syncState`, `keyId`.
- Índice ciego (*blind index*) y búsqueda por código. En v1 no hay búsqueda; si se necesita, se decide aparte.
- Tablas separadas de tamizajes, consentimientos o remisiones. En v1 viven **dentro** del caso cifrado (TR-001 sección 6.1). Las remisiones salen de `content/` y no se guardan.
- Borrado de emergencia (`wipe`), respaldo cifrado exportable, revocación de consentimiento, borrado lógico.
- Temporizador de inactividad, `visibilitychange` y salida rápida (T5).
- Cualquier pantalla o componente de UI.

## 4. Diseño

### 4.1 Esquema Dexie

Archivo `apps/web/src/storage/db.ts`. Conserva la versión 1 y añade la 2. No cambies el nombre de la base (`saviatech`).

```ts
this.version(1).stores({ cryptoMetadata: '&key' });
this.version(2).stores({
  cryptoMetadata: '&key',
  cases: '&id, actualizadoEn',
});
```

- Tabla `cases`: `Table<EncryptedRecord, string>`, usando `EncryptedRecord` de `crypto/`. No definas otro formato.
- Solo `id` y `actualizadoEn` quedan en claro. Ambos son no sensibles: el `id` es un UUID aleatorio sin relación con la persona.
- La migración 1→2 no debe tocar ni perder la fila `cryptoMetadata`. Hay una prueba (T4-10).

> **Decisión D1.** TR-001 §6.1 dice «solo `id` y `createdAt` indexados», pero T3 implementó `actualizadoEn` y no existe `createdAt` en claro. Por defecto, T4 indexa `actualizadoEn` (listar «más recientes primero») y guarda `createdAt` dentro del cifrado. Registra esto en el ADR-0005 y corrige el texto de TR-001 §6.1.

### 4.2 Modelo del caso

Archivo `apps/web/src/model/case.ts` (tipos, `parseCasePayload` y `generateCaseCode`). Es el contenido que se cifra:

```ts
export interface ConsentEntry {
  textVersion: string; // versión del texto aceptado, p. ej. "sample-1"
  timestamp: string; // ISO 8601 UTC
}

export interface ScreeningEntry {
  instrumentId: string;
  instrumentVersion: string;
  answers: number[];
  score: number;
  computedBand: string; // id de banda calculado por packages/rules
  finalBand: string; // decisión de la profesional
  justification: string | null; // obligatoria si finalBand !== computedBand
  safetyAlert: boolean;
  timestamp: string;
}

export interface CasePayload {
  code: string; // seudónimo legible, p. ej. "K7QM-3XPA"
  synthetic: boolean; // true en todo dato de demo y pruebas
  createdAt: string; // ISO 8601 UTC
  consent: ConsentEntry; // obligatorio: no se persiste un caso sin consentimiento
  screenings: ScreeningEntry[];
}

export interface CaseRecord extends CasePayload {
  id: string;
  updatedAt: number; // = actualizadoEn del registro
}
```

Notas:

- `consent` es obligatorio al crear. El estado «en curso» (antes del consentimiento) vive solo en memoria y la salida rápida lo descarta (TR-001 §6.2). Así nunca queda un caso a medias en disco.
- Reutiliza los tipos de `@saviatech/rules` donde existan (por ejemplo, ids de banda como `string`). No dupliques lógica de puntuación: el repositorio **no calcula** bandas, solo guarda lo que recibe.
- `parseCasePayload(value: unknown): CasePayload` valida forma y tipos con código propio, sin librerías, y lanza `CorruptDataError` (de `crypto/errors`) si algo no cuadra. Se usa tras descifrar y también antes de cifrar.
- Invariante validada en `parseCasePayload`: en cada tamizaje, si `finalBand !== computedBand`, `justification` debe ser un texto no vacío tras `trim()`. Si no, `InvalidCaseDataError`.

**Código seudónimo** (`generateCaseCode(): string`): formato `XXXX-XXXX`, alfabeto de 32 símbolos sin ambiguos `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Se genera con `crypto.getRandomValues` (a través de `getRandomBytes` si ya existe en `crypto/webcrypto.ts`; si no es exportado, pregunta). Como 256 es múltiplo de 32, `byte % 32` no introduce sesgo; deja un comentario que lo explique. No hay comprobación de unicidad (32^8 combinaciones, colisión despreciable); documéntalo.

### 4.3 Repositorio

Archivo `apps/web/src/storage/caseRepository.ts`. Es una fábrica con inyección de dependencias, sin singletons globales (el cableado final es de T5):

```ts
export interface NewCaseInput {
  consent: ConsentEntry;
  synthetic: boolean;
  screenings?: ScreeningEntry[]; // por defecto []
}

export interface ListOptions {
  limit?: number; // por defecto 20, máximo 100
  offset?: number; // por defecto 0
}

export interface ListResult {
  items: CaseRecord[]; // más recientes primero
  unreadableIds: string[]; // registros que no se pudieron descifrar
}

export interface CaseRepository {
  create(input: NewCaseInput): Promise<CaseRecord>;
  get(id: string): Promise<CaseRecord | null>;
  list(options?: ListOptions): Promise<ListResult>;
  count(): Promise<number>;
  update(id: string, updater: (current: CasePayload) => CasePayload): Promise<CaseRecord>;
}

export function createCaseRepository(deps: { db: SaviaDatabase; keyring: Keyring }): CaseRepository;
```

Comportamiento:

- **Bloqueo.** Toda operación pasa por `keyring.withDataKey`. Si está bloqueado, lanza `VaultLockedError` (ya existe; no crees otro). No se atrapa ni se traduce.
- **`create`.** `id = crypto.randomUUID()`; `code = generateCaseCode()`; `createdAt = new Date().toISOString()`. Valida con `parseCasePayload`, cifra con `session.encrypt('cases', id, payload)` y hace `db.cases.add(record)`.
- **`get`.** Lee la fila por `id`. Si no existe devuelve `null`. Descifra con `session.decrypt('cases', id, row)` usando el `id` **pedido** (no `row.id`), y valida con `parseCasePayload`.
- **`list`.** `db.cases.orderBy('actualizadoEn').reverse().offset(o).limit(l)`. Descifra **solo** las filas de la página, nunca toda la tabla. Si una fila falla por `CorruptDataError`, no se aborta el listado: su id va a `unreadableIds` y el resto se devuelve. Cualquier otro error (incluido `VaultLockedError`) se propaga.
- **`update`.** Cuidado con Dexie: **no hagas llamadas a WebCrypto dentro de una transacción de IndexedDB** (la transacción puede cerrarse sola mientras esperas una promesa que no es de IndexedDB). El patrón es:
  1. leer la fila y descifrar (fuera de transacción);
  2. aplicar `updater` y validar con `parseCasePayload`;
  3. rechazar con `ImmutableFieldError` si cambió `code`, `createdAt` o `consent`;
  4. cifrar con un IV nuevo y `updatedAt = max(Date.now(), anterior + 1)`;
  5. abrir una transacción `rw` corta que **compare** el `actualizadoEn` actual con el leído en el paso 1 y haga `put` solo si coincide; si no, `ConcurrentModificationError`.
  `actualizadoEn` no está autenticado (ver README de crypto): sirve para detectar edición concurrente, no como evidencia clínica.
- **`count`.** `db.cases.count()`. No requiere clave, pero también debe lanzar `VaultLockedError` si el almacén está bloqueado, para que el comportamiento sea uniforme (comprueba con `keyring.getState()`).

Errores nuevos en `apps/web/src/storage/errors.ts` (mensajes en inglés, genéricos, sin datos del caso): `CaseNotFoundError`, `ConcurrentModificationError`, `ImmutableFieldError`, `InvalidCaseDataError`. Extienden `CryptoDomainError` o una base propia, lo que encaje mejor con el código actual.

### 4.4 Almacenamiento persistente

Archivo `apps/web/src/storage/persistence.ts`:

```ts
export type PersistenceStatus = 'granted' | 'denied' | 'unsupported';
export function requestPersistentStorage(): Promise<PersistenceStatus>;
export function estimateStorage(): Promise<{ usage: number; quota: number } | null>;
```

Usa `navigator.storage.persist()` y `navigator.storage.estimate()`, con manejo de navegadores que no los tienen. Sin UI: T5/T6 mostrarán la advertencia si el estado es `denied`. No lo llames al importar el módulo.

> **Decisión D2.** El README de crypto asigna la persistencia a «tareas posteriores», pero TR-001 §5 la exige y T4 es la capa de almacenamiento. Por defecto se incluye aquí.

### 4.5 Estructura de archivos

```
apps/web/src/model/case.ts
apps/web/src/storage/db.ts                 (versión 2)
apps/web/src/storage/caseRepository.ts
apps/web/src/storage/persistence.ts
apps/web/src/storage/errors.ts
apps/web/src/storage/index.ts              (exporta la API pública)
apps/web/src/storage/__tests__/            (pruebas junto al código)
docs/adr/0005-case-storage.md
```

## 5. Pruebas (Vitest + fake-indexeddb)

- Cada prueba usa un nombre de base aislado y un llavero real con `DexieCryptoMetadataStore`. Reutiliza el mecanismo que ya usan las pruebas de `crypto/` para mantener rápido el KDF. **No toques las constantes de producción.**
- Solo datos sintéticos, con `synthetic: true`.
- Extiende `crypto/__tests__/static.test.ts` o crea una prueba equivalente para que `Math.random`, `console.*`, `localStorage` y `sessionStorage` queden prohibidos también en `src/storage/` y `src/model/`.

## 6. Criterios de aceptación

| ID | Criterio |
| --- | --- |
| T4-01 | Ida y vuelta: lo que se crea con `create` se recupera idéntico con `get` y `list`. |
| T4-02 | **Volcado en crudo (F8):** tras guardar un caso, recorrer todas las filas de `cases` y serializarlas (los `Uint8Array` incluidos) no contiene el `code`, el texto de la justificación, `instrumentId` ni los nombres de campo del payload. Cada fila tiene exactamente `id`, `v`, `iv`, `ct` y `actualizadoEn`. |
| T4-03 | Con el almacén bloqueado, `create`, `get`, `list`, `count` y `update` lanzan `VaultLockedError`. Lo mismo tras llamar a `lock()` con un repositorio ya creado. |
| T4-04 | Mover el `ct` de un caso a la fila de otro `id` hace fallar la lectura de ese `id` (`CorruptDataError`). Alterar un byte de `ct` también. |
| T4-05 | `changePin` no re-cifra: los casos siguen legibles con el PIN nuevo y las filas de `cases` no cambian. |
| T4-06 | Migración: una base creada con la versión 1 (con el llavero ya inicializado) se abre en la versión 2, conserva `cryptoMetadata`, desbloquea con el mismo PIN y permite crear casos. |
| T4-07 | `update` rechaza cambios en `code`, `createdAt` y `consent` (`ImmutableFieldError`) y rechaza un `finalBand` distinto del calculado sin justificación (`InvalidCaseDataError`). |
| T4-08 | Dos `update` concurrentes sobre el mismo caso: uno gana y el otro lanza `ConcurrentModificationError`; ningún cambio se pierde en silencio. |
| T4-09 | `list` con 1.000 casos sintéticos devuelve páginas ordenadas por más reciente y **descifra solo los registros de la página** (se verifica contando llamadas a `decrypt`). Una fila corrupta aparece en `unreadableIds` sin romper el listado. |
| T4-10 | `generateCaseCode` produce el formato `XXXX-XXXX` con el alfabeto definido y no repite en 10.000 generaciones de prueba. |
| T4-11 | `requestPersistentStorage` devuelve `granted`, `denied` o `unsupported` según un doble de `navigator.storage`; `estimateStorage` devuelve `null` si no hay soporte. |
| T4-12 | La prueba estática confirma que `src/storage/` y `src/model/` no usan `Math.random`, `console`, `localStorage` ni `sessionStorage`. |
| T4-13 | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` y `npm run licenses` pasan, y no hay dependencias nuevas en `package.json` ni en `package-lock.json`. |

El rendimiento en un Android de gama baja **no** se declara cumplido por las pruebas en Node. Queda como medición manual pendiente (se registra en el README junto a la del KDF).

## 7. Documentación que debe actualizar T4

- `docs/adr/0005-case-storage.md` (corto, en inglés): índices `id` + `actualizadoEn` (D1), casos como único registro persistido, patrón de actualización con comprobación optimista fuera de la transacción de WebCrypto, persistencia incluida (D2).
- `apps/web/src/crypto/README.md`: sección «Storage integration».
- `docs/specs/TR-001-vertical-slice.md`: estado «T4 implemented» y corrección de §6.1 según D1.
- `docs/threat-model.md`: añadir (a) el nombre de la base y de la tabla son visibles en IndexedDB (`saviatech`, `cases`); (b) `actualizadoEn` y el número de casos son visibles; (c) sin protección contra *rollback*; (d) apertura simultánea en dos pestañas sigue siendo un límite abierto.
- `README.md`: solo si cambia algún comando o paso de la demo.

> **Decisión D3 (humana, no se implementa en T4).** El nombre `saviatech` de la base delata la app a quien revise el teléfono. Decidir en T8 si se vuelve configurable en build (`VITE_DB_NAME`) o se deja documentado como límite.

## 8. Forma de trabajo

1. **Plan primero.** Presenta el plan, supuestos, preguntas abiertas y cómo verificarás cada criterio T4-01 a T4-13. Espera aprobación.
2. Trabaja en la rama `feat/t4-almacenamiento`, con commits convencionales y descripciones en español (por ejemplo `feat(storage): agrega migración v2 y tabla de casos`).
3. Orden sugerido, con una revisión entre pasos:
   - **4a:** `model/case.ts` + pruebas, y `db.ts` versión 2 + prueba de migración (T4-06, T4-10).
   - **4b:** `caseRepository.ts` + errores + pruebas (T4-01 a T4-09).
   - **4c:** `persistence.ts`, prueba estática, ADR y documentos (T4-11 a T4-13).
4. Antes de dar la tarea por terminada, ejecuta lint, typecheck, tests, build y licenses, y **reporta el resultado real**, también si algo falla.
5. Cierra con: qué cambió, qué te dejó dudas y qué necesita una decisión humana.

## 9. Pendiente para TR-002 (no hacer ahora)

Outbox y sincronización, formato de evento con versión de clave, índice ciego, borrado de emergencia, respaldo cifrado, revocación de consentimiento, protección contra *rollback* con contador autenticado, y el repositorio `saviatech-api` (NestJS + PostgreSQL + Keycloak, servidor con cifrado opaco, agregados con umbral mínimo).
