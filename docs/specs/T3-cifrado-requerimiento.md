# T3 — Cifrado local: PBKDF2, envoltura de la clave de datos y AES-GCM por registro

**Repositorio:** frontend (PWA). El backend/API NO se toca en esta tarea.
**Dependencias:** T1 y T2 terminadas. Antes de empezar, lee el código existente y adapta nombres, rutas y tipos a lo que ya hay. No dupliques módulos.
**Auditoría posterior:** este código será auditado por una persona y por otro agente. Escribe pensando en que otro lo va a revisar línea por línea.

---

## 1. Objetivo

Que todo dato sensible guardado en IndexedDB (Dexie) quede cifrado en el dispositivo, con una clave que depende de un PIN que solo conoce la usuaria. Sin el PIN, el contenido guardado en el teléfono debe ser ilegible.

Escenario de amenaza principal: **alguien con acceso físico al teléfono desbloqueado (por ejemplo, un agresor) abre el navegador o las herramientas de desarrollo y lee IndexedDB.**

## 2. Reglas no negociables

1. Usar **solo la API nativa WebCrypto** (`crypto.subtle`). Prohibido implementar criptografía propia o añadir librerías criptográficas de terceros (CryptoJS, forge, sjcl, etc.). Si crees que hace falta una dependencia, detente y pregunta.
2. **Prohibido** usar `Math.random()`. La aleatoriedad sale solo de `crypto.getRandomValues`.
3. **Nunca** guardar el PIN, la KEK ni la DEK en claro, ni en `localStorage`, `sessionStorage`, IndexedDB, cookies, logs, mensajes de error, ni enviarlos a red.
4. **Nunca** registrar (`console.*`) PIN, claves, IV, textos planos ni textos cifrados.
5. Los parámetros criptográficos van en **constantes con nombre** en un solo archivo, no dispersos como números mágicos.
6. Todo es TypeScript estricto (`strict: true`), sin `any`.
7. Escribe las pruebas **antes o junto con** el código. Sin pruebas pasando, la tarea no está terminada.
8. Si algo de este documento es ambiguo o contradice el código existente, **pregunta antes de decidir**.

## 3. Diseño (jerarquía de claves)

```
PIN ──PBKDF2-HMAC-SHA256 (salt aleatoria, N iteraciones)──► KEK (AES-KW 256, no extraíble)
                                                              │ envuelve
                                                              ▼
                                         DEK (AES-GCM 256, aleatoria)  ← se guarda envuelta
                                                              │ cifra
                                                              ▼
                                  Cada registro: AES-GCM con IV propio + AAD
```

### 3.1 Derivación de la KEK (PBKDF2)

- Algoritmo: `PBKDF2`, hash `SHA-256`, salida de 256 bits.
- Salt: 16 bytes aleatorios, generada una vez por instalación/usuaria y guardada junto al material envuelto.
- Iteraciones: **mínimo 600.000** (referencia OWASP para PBKDF2-HMAC-SHA256). Debe ser un parámetro guardado en los metadatos (`kdf.iterations`), para poder subirlo en el futuro sin romper datos antiguos.
- La KEK se importa/deriva como `CryptoKey` **no extraíble** (`extractable: false`) con usos `["wrapKey", "unwrapKey"]` y algoritmo `AES-KW`.
- Documentar en un comentario y en el README del módulo el tiempo medido de derivación en un Android de gama baja. Si supera ~2 s, **no bajes las iteraciones por tu cuenta**: reporta el dato y se decide.

### 3.2 Clave de datos (DEK) y su envoltura

- Se genera **una sola vez** al crear el almacén: `AES-GCM`, 256 bits, `extractable: true` únicamente en el momento de generarla (necesario para envolverla).
- Se envuelve con la KEK usando `crypto.subtle.wrapKey("raw", dek, kek, "AES-KW")`.
- Lo que se persiste es solo el resultado envuelto, más metadatos (ver 3.5).
- Al desbloquear: `unwrapKey` con `extractable: false` y usos `["encrypt", "decrypt"]`. **La DEK desbloqueada debe quedar como `CryptoKey` no extraíble.**
- **Verificación del PIN:** no se guarda ningún hash del PIN. Un PIN incorrecto se detecta porque `unwrapKey` falla (`OperationError`). Ese fallo se traduce a un error de dominio genérico (`PinIncorrectoError`) sin detalles internos.

### 3.3 Cifrado por registro (AES-GCM)

- Cada vez que se cifra un registro: **IV nuevo de 12 bytes** con `crypto.getRandomValues`. Nunca reutilizar un IV con la misma clave.
- Tag de autenticación de 128 bits (valor por defecto de WebCrypto; dejarlo explícito en la constante).
- **AAD (datos adicionales autenticados):** concatenar de forma determinista `nombreDeTabla | idDeRegistro | versionDeEsquema`. Así un registro cifrado no puede copiarse a otro id o tabla sin que falle la autenticación.
- Se cifra el contenido serializado del registro (JSON → UTF-8). Los campos que se necesiten para índices o consultas deben ser el mínimo posible; documenta cuáles quedan en claro y por qué.
- Formato guardado por registro:

```ts
interface RegistroCifrado {
  id: string;          // en claro (necesario para AAD e índice)
  v: number;           // versión del formato de cifrado
  iv: Uint8Array;      // 12 bytes
  ct: Uint8Array;      // texto cifrado + tag
  actualizadoEn: number;
}
```

### 3.4 Ciclo de vida y bloqueo

- Estados: `SIN_INICIALIZAR` → `BLOQUEADO` ⇄ `DESBLOQUEADO`.
- `inicializar(pin)`: genera salt y DEK, deriva KEK, envuelve la DEK, persiste metadatos.
- `desbloquear(pin)`: deriva KEK, desenvuelve DEK, la deja en memoria (solo en una variable de módulo/cierre, no en el store global ni en estado serializable).
- `bloquear()`: elimina toda referencia a la DEK. Se invoca: manualmente, por inactividad (tiempo configurable) y cuando la app pasa a segundo plano (`visibilitychange`).
- `cambiarPin(pinActual, pinNuevo)`: **solo re-envuelve la DEK** con una KEK nueva (salt nueva). No se re-cifran los registros.
- **Control de intentos:** contador de fallos persistido, con espera creciente (por ejemplo 0, 0, 5 s, 30 s, 5 min…). Es un freno a la fuerza bruta *dentro de la app*; documenta que **no protege** contra un atacante que copie IndexedDB y ataque offline (ver sección 7).

### 3.5 Metadatos persistidos (un solo registro, sin secretos en claro)

```ts
interface MetadatosCifrado {
  v: number;
  kdf: { alg: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: Uint8Array };
  dekEnvuelta: Uint8Array;  // resultado de wrapKey con AES-KW
  intentosFallidos: number;
  bloqueadoHasta: number | null;
}
```

## 4. Estructura de archivos sugerida (ajustar a lo existente)

```
src/crypto/
  constants.ts        // parámetros: iteraciones, tamaños, versión de formato
  kdf.ts              // derivarKek(pin, salt, iteraciones)
  keyring.ts          // inicializar, desbloquear, bloquear, cambiarPin, estado
  recordCipher.ts     // cifrarRegistro, descifrarRegistro (con AAD)
  errors.ts           // PinIncorrectoError, AlmacenBloqueadoError, DatosCorruptosError
  index.ts            // API pública mínima
  README.md           // diseño, parámetros, límites conocidos
src/crypto/__tests__/
```

La capa de datos (Dexie) debe usar `recordCipher` a través de una interfaz; no debe conocer detalles de WebCrypto.

## 5. Pruebas requeridas (Vitest)

Usar el `webcrypto` de Node 20+ y `fake-indexeddb` si hace falta.

1. Ida y vuelta: cifrar y descifrar devuelve el objeto original.
2. IV distinto en dos cifrados del mismo contenido; textos cifrados distintos.
3. Manipular un byte del `ct` o del `iv` → falla con `DatosCorruptosError`.
4. Cambiar el `id` o la tabla del registro (AAD distinto) → falla.
5. PIN incorrecto → `PinIncorrectoError`; PIN correcto → desbloquea.
6. `bloquear()` → cifrar/descifrar lanza `AlmacenBloqueadoError`.
7. `cambiarPin`: con el PIN nuevo se leen los registros antiguos; con el PIN viejo ya no.
8. Salt y `dekEnvuelta` distintas entre dos inicializaciones.
9. La DEK desbloqueada y la KEK tienen `extractable === false`.
10. Vector de prueba conocido de PBKDF2-HMAC-SHA256 para validar `kdf.ts`.
11. Control de intentos: la espera crece y se respeta tras recargar (persistencia).
12. Prueba estática: ningún archivo de `src/crypto/` contiene `Math.random`, `console.` ni importa librerías criptográficas externas (puede ser una regla ESLint).

## 6. Criterios de aceptación

- [ ] Todas las pruebas de la sección 5 pasan en CI.
- [ ] `tsc --noEmit` y ESLint sin errores ni advertencias.
- [ ] Inspeccionando IndexedDB en el navegador no aparece ningún dato sensible legible.
- [ ] No hay claves ni PIN en `localStorage`/`sessionStorage`.
- [ ] README del módulo con diseño, parámetros, tiempo de derivación medido y límites conocidos.
- [ ] Commits pequeños, con mensajes claros (convencional: `feat(crypto): ...`, `test(crypto): ...`).
- [ ] Lista final de decisiones tomadas y dudas abiertas, redactada por ti, para la auditoría.

## 7. Límites conocidos (documentar, no ocultar)

1. **El PIN corto es débil frente a un ataque offline.** Un PIN de 4 a 6 dígitos tiene muy pocas combinaciones; aunque PBKDF2 lo encarece, alguien que copie IndexedDB puede probarlas todas. Mitigaciones a evaluar (fuera de esta tarea): permitir contraseña alfanumérica, PIN más largo, o un componente secreto adicional.
2. Si la usuaria olvida el PIN, los datos locales no se pueden recuperar. Definir la política de recuperación (por ejemplo, respaldo sincronizado al servidor) en una tarea aparte.
3. El navegador puede expulsar el almacenamiento local; se resuelve con `navigator.storage.persist()` y sincronización, no con este módulo.
4. WebCrypto no garantiza borrado de memoria; `bloquear()` elimina referencias pero no puede forzar la limpieza física.

## 8. Fuera de alcance

Backend/API, sincronización, tamizajes, interfaz de PIN más allá de lo mínimo para probar, exportación a DHIS2, análisis con IA.

## 9. Cómo trabajar (instrucciones para el agente)

1. Lee el código existente y el `AGENTS.md` del repositorio. Resume en pocas líneas qué encontraste y qué vas a modificar, **antes** de escribir código.
2. Trabaja en una rama `feat/t3-cifrado`. Un commit por paso lógico.
3. Orden sugerido: constantes y errores → `kdf` → `recordCipher` → `keyring` → integración con Dexie → README.
4. Ejecuta las pruebas y el linter después de cada paso.
5. No modifiques archivos fuera de `src/crypto/` y el punto mínimo de integración con la capa de datos, salvo que lo justifiques.
6. Al terminar, entrega el resumen de decisiones y dudas. No marques la tarea como terminada si falta algún criterio de la sección 6.

---

## 10. Estado de implementación

Fecha: 2026-10-26. Rama: `feat/t3-cifrado`. No se han realizado commits; los cambios quedan para
revisión y para que la persona responsable los commitee.

Implementado:

- Jerarquía PIN → PBKDF2-HMAC-SHA256 (600.000 iteraciones, sal de 16 bytes) → KEK AES-KW no extraíble
  → DEK AES-GCM envuelta y no extraíble al desbloquear.
- Cifrado por registro AES-GCM con IV de 12 bytes, tag de 128 bits y AAD `tabla|id|versión`.
- Metadatos en Dexie con parámetros KDF, DEK envuelta, intentos fallidos y `lockedUntil`.
- Llavero con `load`, `initialize`, `unlock`, `lock`, `changePin` y `withDataKey`.
- `withDataKey` entrega una sesión acotada (`DataKeySession`) con `encrypt`, `decrypt` y `extractable`;
  no expone el `CryptoKey` y vuelve a comprobar el bloqueo en cada llamada.
- `load`, `initialize`, `unlock` y `changePin` se serializan dentro de un llavero. `lock()` incrementa
  una generación que impide publicar una clave si la operación seguía en curso.
- Re-envoltura de la DEK al cambiar el PIN, sin volver a cifrar registros. La DEK se desenvuelve
  temporalmente como extraíble solo para AES-KW y se vuelve a desenvolver como no extraíble. Las
  iteraciones de un almacén existente nunca se reducen.
- Esperas por intentos: 0, 0, 5 s, 30 s y 5 min, persistidas y reiniciadas al acertar.
- Validación de metadatos: versión, algoritmos, tamaños exactos de sal y DEK envuelta, iteraciones
  mínimas y contadores. Una fila corrupta falla como `CorruptDataError`, no como PIN incorrecto.
- Reglas ESLint específicas: sin `console`, sin `Math.random`, sin almacenamiento web y sin
  importaciones criptográficas externas. La prueba estática recorre subdirectorios futuros.
- 34 pruebas de criptografía y 51 pruebas de reglas pasando (85 en total).

Pendiente para cerrar la tarea al 100 %:

- Medir PBKDF2 en un Android de gama baja. En el equipo de desarrollo (Windows, Node.js 24.19.0) se
  midieron aproximadamente 262 ms por derivación a 600.000 iteraciones. No se bajarán las iteraciones.
- Revisión independiente humana del código criptográfico antes de la integración con T4. Ya se hizo una
  revisión automatizada y se corrigieron sus hallazgos: carreras de intentos, bloqueo durante operaciones
  en curso, exposición del `CryptoKey`, validación de metadatos y cobertura estática.
- La comprobación de IndexedDB sin texto plano sobre casos reales corresponde a T4/T6; T3 solo crea la
  tabla de metadatos.
- Confirmar el benchmark y la revisión humana antes de considerar cumplidos todos los criterios de la
  sección 6.

Límites conocidos añadidos tras la revisión: no hay protección contra rollback de un ciphertext antiguo
con el mismo `tabla|id|versión`; el contador de intentos se serializa dentro de un llavero, pero no entre
pestañas; dos pestañas que inicialicen o cambien el PIN a la vez pueden sobrescribir los metadatos; los
disparadores automáticos de bloqueo por inactividad y `visibilitychange` se conectan en T5/T6.

### Commits sugeridos

Los mensajes usan Conventional Commits con descripción en español, según `AGENTS.md`:

1. `docs: actualiza las convenciones de ramas e idioma`
   - `AGENTS.md`
   - `CONTRIBUTING.md`
   - `docs/adr/0004-language-conventions.md`
2. `chore(web): configura Vitest y las dependencias del cifrado`
   - `apps/web/package.json`
   - `package-lock.json`
3. `feat(crypto): agrega constantes, errores y utilidades de WebCrypto`
   - `apps/web/src/crypto/constants.ts`
   - `apps/web/src/crypto/errors.ts`
   - `apps/web/src/crypto/webcrypto.ts`
4. `feat(crypto): deriva la KEK con PBKDF2-HMAC-SHA256`
   - `apps/web/src/crypto/kdf.ts`
   - `apps/web/src/crypto/__tests__/kdf.test.ts`
5. `feat(crypto): cifra registros con AES-GCM y AAD`
   - `apps/web/src/crypto/recordCipher.ts`
   - `apps/web/src/crypto/__tests__/recordCipher.test.ts`
6. `feat(crypto): agrega el llavero y los metadatos persistentes`
   - `apps/web/src/crypto/metadata.ts`
   - `apps/web/src/crypto/keyring.ts`
   - `apps/web/src/crypto/index.ts`
   - `apps/web/src/crypto/__tests__/metadata.test.ts`
   - `apps/web/src/crypto/__tests__/keyring.test.ts`
   - `apps/web/src/storage/db.ts`
   - `apps/web/src/storage/cryptoMetadataStore.ts`
7. `test(crypto): verifica reglas estáticas del módulo`
   - `apps/web/src/crypto/__tests__/static.test.ts`
   - `eslint.config.js`
8. `docs: documenta el cifrado local de la tarea 3`
   - `README.md`
   - `SECURITY.md`
   - `docs/threat-model.md`
   - `docs/adr/0003-local-encryption.md`
   - `docs/specs/TR-001-vertical-slice.md`
   - `docs/specs/T3-cifrado-requerimiento.md`
   - `apps/web/src/crypto/README.md`

Nota: `packages/rules/src/index.test.ts` solo recibió el salto de línea final que exige Prettier. Puede
ir en un commit `style(rules): agrega salto de línea final` o junto con el commit de documentación.
