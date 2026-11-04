# T8 — Documentación final: README de demostración, modelo de amenazas, SECURITY.md y ADRs

**Versión:** 0.1
**Repositorio:** frontend (PWA, `proyecto-savia-tech-web`). El backend no existe en este repositorio y queda para TR-002. No lo toques ni lo simules.
**Dependencias:** T1 a T7 terminadas. Antes de empezar, lee `AGENTS.md`, `docs/specs/TR-001-vertical-slice.md` (secciones 2, 5, 6, 7, 8, 10 y 11), todos los ADR de `docs/adr/`, `docs/threat-model.md`, `SECURITY.md`, `README.md` y `apps/web/src/crypto/README.md`.
**Fecha objetivo:** demo y repositorio público listos el 2026-11-03. El cierre de UNICEF es el 2026-11-04 a las 11:59 p. m. CET, que equivale a las 5:59 p. m. del mismo día en Colombia (CET es UTC+1 desde el 25 de octubre). Si el tiempo aprieta, el orden de prioridad es: 8a, 8b, 8c, 8d (sección 9). 8e y 8f se recortan primero.
**Auditoría posterior:** lo revisará una persona y otro agente. Esta tarea es de documentación: el código es la fuente de verdad y todo lo que se escriba debe poder comprobarse contra él.
**Modelo de trabajo:** pasos cortos, un archivo a la vez. Antes de afirmar algo sobre el comportamiento de la app, ábrelo en el código o en una prueba y cítalo (ruta del archivo). No afirmes nada que no hayas comprobado. Empieza en modo plan: presenta el plan, los supuestos y las dudas, y espera aprobación antes de editar.

---

## 1. Objetivo

Dejar el repositorio listo para que una persona externa (un evaluador de UNICEF, un colaborador de código abierto, una profesional de Trabajo Social) lo entienda, lo ejecute y juzgue su seguridad **sin hablar con el equipo**:

1. **README con pasos de demostración**: una persona nueva clona, instala y recorre el flujo completo (TR-001 §1) en menos de 10 minutos, incluida la prueba sin red.
2. **Modelo de amenazas revisado**: organizado por amenaza y no por tarea, con adversarios, controles, pruebas que los respaldan, riesgo residual y decisiones pendientes. Deja de ser un borrador.
3. **SECURITY.md vigente**: refleja lo implementado hasta T7 y dice cómo reportar y qué esperar.
4. **ADRs completos y coherentes**: índice, metadatos uniformes, y los ADR de las decisiones que hoy están sin registrar o abiertas.
5. **Higiene del repositorio público**: sin ruido de terceros ni inconsistencias entre documentos.

Escenario de amenaza (el mismo de T3 a T7): alguien hostil con acceso al teléfono. Riesgo propio de T8: **documentar de más**. Una afirmación falsa o exagerada de seguridad es peor que una laguna reconocida, porque la usarán personas en peligro y evaluadores que decidirán con ella.

---

## 2. Reglas no negociables

Rigen todas las de `AGENTS.md` y T3 a T7. Además, para esta tarea:

1. **Cero afirmaciones sin evidencia.** Cada control que cite el modelo de amenazas lleva la ruta del código y, si existe, de la prueba que lo demuestra. Si no hay prueba, escribe «sin prueba automatizada».
2. **Nada de lenguaje inflado.** No escribas «seguro», «auditado», «a prueba de», «listo para producción» ni «cumple» (con Ley 1581, GDPR u otra norma). Escribe qué hace y qué no. Esta revisión es **interna**, no una auditoría independiente, y debe decirlo.
3. **No describas ejecuciones sintéticas como resultados de piloto.** El repositorio solo tiene datos sintéticos. El cuestionario de UNICEF pide prototipo con resultados iniciales; eso se responde en la postulación con evidencia real, no en este repositorio con frases ambiguas.
4. **Datos sintéticos únicamente.** Ni capturas, ni vídeos, ni ejemplos con datos reales. No inventes teléfonos, líneas de ayuda ni instituciones. Todo lo clínico sigue marcado `SAMPLE`.
5. **No cambies código de la aplicación.** Excepción única: la decisión D3 (sección 5), solo si una persona la aprueba por escrito. No toques `crypto/`, `storage/`, reglas, flujos ni dependencias. Si al documentar encuentras un defecto, repórtalo; no lo corrijas en esta tarea.
6. **No borres contenido del modelo de amenazas.** Lo existente se reubica (Apéndice A), se corrige si es inexacto, y se marca lo que se corrigió. Nada se elimina sin dejarlo dicho.
7. **No reescribas decisiones de ADR aceptados.** Si una decisión cambia, se crea un ADR nuevo que declara `Supersedes`. Sí puedes corregir metadatos (encabezado, enlaces, erratas).
8. **Idioma (ADR-0004).** Documentación en inglés; comentarios de código y JSDoc en español; los requerimientos de `docs/specs/` siguen en español; los mensajes de commit llevan tipo en inglés y descripción en español.
9. **Los límites conocidos se dicen de frente.** Lo pendiente (T7-20 en un Android real, T9, TR-002, revisión independiente) aparece como pendiente, con nombre y responsable, no se omite.

---

## 3. Alcance

### Incluye

- 8a: reestructuración del `README.md` con una sección «Run the demo» y una sección de estado honesto.
- 8b: revisión y reorganización de `docs/threat-model.md`.
- 8c: actualización de `SECURITY.md` (y de los correos repetidos en `CODE_OF_CONDUCT.md` si se decide cambiarlos).
- 8d: `docs/adr/README.md` (índice), corrección de metadatos de ADR existentes y nuevos ADR 0009 a 0013.
- 8e: higiene del repositorio público (sección 6.5), según decisiones humanas.
- 8f: un verificador de documentación sin dependencias (`npm run docs:check`), si hay tiempo.
- Actualizar el estado de tareas en `docs/specs/TR-001-vertical-slice.md`, `AGENTS.md` y `CONTRIBUTING.md` (sección 8).

### No incluye (no lo construyas)

| Fuera de alcance | Dónde va |
|---|---|
| Datos sintéticos de demostración (semilla), guion ejecutable de la demo | T9 |
| El vídeo de 2 minutos | Equipo, después de T9 |
| Medición en un Android de gama baja (T7-20) | Equipo, con teléfono real |
| Backend, sincronización, DHIS2, panel público | TR-002 |
| Cambio de PIN en la UI, coordinación entre pestañas, anti-rollback | Tareas posteriores (se documentan como límites) |
| Revisión de seguridad independiente, evaluación de impacto de privacidad, revisión legal | Fuera del repositorio; se listan como pendientes |
| Cambios de código, refactors, dependencias nuevas | No en esta tarea (regla 5) |

---

## 4. Estado actual del repositorio (verificado; reconfírmalo antes de actuar)

Se revisó el commit `7a7061e` (rama `main`, 2026-11-02, 52 commits, un solo autor) del archivo `proyecto-savia-tech-web.rar`. Entorno de la revisión: Node 22.22.2, npm 10.9.7.

### 4.1 Lo que se ejecutó y su resultado

| Comprobación | Resultado |
|---|---|
| `npm ci` | Correcto, 461 paquetes |
| `npm run lint` (ESLint + Prettier) | Correcto |
| `npm run typecheck` | Correcto en `apps/web` y `packages/rules` |
| `npm test` | **275 pruebas, todas pasan**: 224 en `apps/web` (24 archivos) y 51 en `packages/rules` (3 archivos) |
| `npm run build` y `npm run budget` | Correcto. JS inicial 126,449 B de 256,000 B; CSS 1,545 B; `index.html` 969 B; `sw.js` 15,762 B; precaché 436,541 B (12 entradas). **Coinciden exactamente con la tabla del README** |
| `npm run licenses` | Correcto: MIT 392, ISC 18, BSD-3-Clause 6, CC-BY-4.0 1 (`caniuse-lite`, excepción nominal de ADR-0008) |
| Exploración del código | Sin `dangerouslySetInnerHTML`, `innerHTML`, `eval` ni `new Function` en `apps/web/src`; sin `fetch`, `XMLHttpRequest`, `WebSocket` ni `sendBeacon` fuera de pruebas; sin secretos en archivos versionados (fuera de `.opencode/`) |
| Cotejo de constantes citadas en la documentación | PBKDF2 600,000 iteraciones, sal de 16 B, IV de 12 B, esperas de bloqueo `[0, 0, 5 s, 30 s, 300 s]` y la CSP de `index.html` coinciden con lo que dicen README, ADR-0003 y el modelo de amenazas |

**No se pudo comprobar:** las pruebas Playwright (e2e) no se ejecutaron porque no había Chromium disponible en el entorno de revisión; su resultado debe confirmarlo la última ejecución de CI. Tampoco se probó en un teléfono real (T7-20 sigue pendiente) ni se hizo una clonación limpia siguiendo el README.

### 4.2 Hallazgos que T8 debe resolver

| ID | Gravedad | Hallazgo | Evidencia | Acción de T8 |
|---|---|---|---|---|
| H1 | Alta | **El README no tiene pasos de demostración.** El criterio de T8 («una persona nueva puede ejecutar la demo desde el README») hoy no se puede cumplir ni verificar. Hay `npm ci` y `npm run dev`, una lista de pantallas y comandos, pero no hay PIN de ejemplo, ni respuestas a usar, ni cómo disparar la alerta de seguridad, ni cómo probar sin red. El párrafo «Status» está escrito para desarrolladores. | `README.md`, secciones «Getting started» y «Status» | 8a |
| H2 | Alta | **El modelo de amenazas se declara incompleto** («placeholder until the T8 review») y está organizado por tarea (T3 a T7), no por amenaza. Faltan escenarios: coacción para entregar el PIN, adversario que ya conoce el PIN, compromiso del alojamiento o de una actualización, defensas que dependen de cabeceras HTTP (ver H9), integridad del contenido clínico, uso con menores. No relaciona cada amenaza con la prueba que la demuestra. D3 sigue abierta. | `docs/threat-model.md`, líneas 3, 145-146, 199 | 8b |
| H3 | Media | **SECURITY.md está desactualizado.** «Current implementation» solo describe T3 y T4; faltan bloqueo automático, salida rápida, CSP, service worker y manifiesto neutral (T5 a T7). No indica plazos de respuesta, versiones soportadas ni alternativa a correos personales. Los mismos dos correos personales aparecen en `CODE_OF_CONDUCT.md`. | `SECURITY.md`; `CODE_OF_CONDUCT.md` líneas 32-33 | 8c |
| H4 | Media | **ADRs: contenido sólido pero incompleto.** Hay 0001 a 0008 con «Alternatives considered». Faltan: índice; la línea `Task:` en 0007 y 0008; y ADR de decisiones que solo viven en specs o en el modelo de amenazas (instrumento y contenido de muestra, alcance «sin backend» en v1, CSP en `<meta>`, política de PIN, nombre de la base D3). D3 (T4) y D6 (cambio de PIN, ADR-0006) siguen abiertas sin ADR propio. | `docs/adr/`; `docs/specs/TR-001` §11 | 8d |
| H5 | **Alta (decisión humana)** | **`.opencode/` está versionado: 441 de 617 archivos rastreados** (commit `9cd9368`), unos 66 MB en disco con su `node_modules` (este último no versionado). Es un kit de terceros («Everything Claude Code») con su propio README. No aparece en el resumen de licencias de `LICENSE` ni en el diseño de carpetas de `AGENTS.md`. En un repositorio público para UNICEF entierra los 176 archivos propios y deja sin resolver la atribución y la licencia del kit. | `git ls-files .opencode \| wc -l` → 441 | 8e (requiere decisión Q1) |
| H6 | Baja | **Dos archivos para T7** con contenido solapado: `T7-pwa-offline-requerimiento.md` (≈32 KB) y `T7-pwa-offline-spec.md` (≈44 KB). Un lector externo no sabe cuál manda. | `docs/specs/` | 8e |
| H7 | Baja | **Inconsistencias menores.** README dice «Node.js 20.19 or newer (see `.nvmrc`)» y `.nvmrc` contiene `20`. `AGENTS.md` titula «Commands (available after task T1 of TR-001)», aunque ya están todos. ADR-0008 midió con Node 24.19.0 y CI usa Node 20 (la revisión con Node 22 reprodujo las mismas cifras). `TR-001` dice «T8 next». | `README.md`, `AGENTS.md`, `.nvmrc`, `TR-001` línea 3 | 8a, 8d, 8e |
| H8 | Baja | `apps/web/.env` está versionado. Hoy solo contiene `VITE_APP_NAME=SaviaTech` y está bien, pero `.gitignore` no protege otros `.env`. | `git ls-files apps/web/.env` | 8e |
| H9 | Media | **Defensas que una `<meta>` CSP no puede aplicar.** La CSP vive en `index.html` (TR-001 §5 lo exige porque el alojamiento estático puede no permitir cabeceras). Las directivas `frame-ancestors`, `report-uri` y `sandbox` **no se aplican desde una etiqueta `<meta>`**, así que la protección contra incrustar la app en un marco de otro sitio depende de cabeceras del servidor. El README recomienda cabeceras de caché y HTTPS, pero no estas. Está por confirmarse con la documentación vigente de CSP antes de escribirlo como hecho. | `apps/web/index.html` líneas 6-9; `README.md` «Recommended static-hosting headers» | 8b, 8d (ADR-0012) |

Lo que **está bien** y no debe tocarse: los ADR 0001 a 0008 (decisiones y alternativas), el contenido por control de T3 a T7 en el modelo de amenazas (se conserva como Apéndice A), la tabla de presupuesto del README y el registro de verificación de T7-16.

---

## 5. Decisiones (usa el valor por defecto y regístralo; una persona puede cambiarlo)

| # | Decisión | Valor por defecto | Responsable |
|---|---|---|---|
| **D1** | Idioma del README | Inglés (ADR-0004). Los pasos de demostración muestran la etiqueta en español **y** en inglés, porque la UI abre en español (`<html lang="es">`). | Ambos |
| **D2** | Dónde viven los pasos de la demo | Sección «Run the demo» del README, autosuficiente. El guion de vídeo de TR-001 §10 se queda en la especificación. | Director técnico |
| **D3** | **Nombre de la base `saviatech` (heredada de T4 D3).** El nombre visible en IndexedDB delata la app a quien inspeccione el teléfono. | **Se documenta como límite y se registra en ADR-0009**. No se cambia código. Alternativa: `VITE_DB_NAME` en build (cambio pequeño en `storage/db.ts` más pruebas). Advertencia: renombrar la base después del primer uso **deja huérfanos los vaults ya creados**, así que solo es seguro decidirlo antes de cualquier despliegue real. | Director técnico |
| **D4** | Estructura del modelo de amenazas | Por amenaza, con IDs `T-01…`, y el contenido actual por tarea pasa al Apéndice A. | Director técnico |
| **D5** | Cómo se nombra la revisión | «Internal review v1 (not an independent audit)». Revisión independiente: pendiente. | Ambos |
| **D6** | Contacto de SECURITY.md | Mantener los dos correos actuales **hasta que se decida otra cosa** (Q3). Compromiso de acuse de recibo: 7 días naturales (Q4). Sin programa de recompensas. | Ambos |
| **D7** | ADR nuevos | 0009 nombre de la base; 0010 instrumento y contenido de muestra; 0011 alcance de v1 sin backend; 0012 CSP en `<meta>` y cabeceras de alojamiento; 0013 política de PIN y cambio de PIN diferido. Los de 0009 a 0011 son obligatorios; 0012 y 0013, recomendados. | Director técnico |
| **D8** | `.opencode/` | **No se borra nada en T8 sin respuesta humana (Q1).** Recomendación: dejar de versionarlo (`git rm -r --cached .opencode` y añadirlo a `.gitignore`) y, si el equipo quiere publicarlo, agregarlo en un repositorio aparte con su licencia y atribución. Aviso: quitarlo del árbol **no lo quita del historial**; reescribir historial queda fuera de T8. | Director técnico |
| **D9** | Estado de los ADR abiertos | Los ADR de decisiones sin cerrar usan `Status: proposed` y listan qué falta decidir y quién. `accepted` solo si una persona lo confirmó. | Ambos |

---

## 6. Diseño

### 6.1 Archivos nuevos y modificados

| Archivo | Cambio |
|---|---|
| `README.md` | Reestructurado (6.2) |
| `docs/threat-model.md` | Reorganizado (6.3) |
| `SECURITY.md` | Actualizado (6.4) |
| `docs/adr/README.md` | Nuevo: índice y leyenda de estados |
| `docs/adr/0007-case-flows.md`, `0008-pwa-offline.md` | Solo metadatos (`Task:`) |
| `docs/adr/0009` a `0013` | Nuevos (6.5) |
| `AGENTS.md`, `CONTRIBUTING.md`, `docs/specs/TR-001-vertical-slice.md` | Estado y erratas (sección 8) |
| `.gitignore`, `LICENSE` (resumen), `docs/specs/` | Solo si Q1 y Q2 lo piden (6.6) |
| `scripts/check-docs.mjs`, `package.json`, `.github/workflows/ci.yml` | Solo 8f (6.7) |

### 6.2 README (8a)

Conserva todo el contenido técnico actual (comandos, estructura, configuración, PWA, cabeceras, mediciones, registro de verificación, reglas, licencias) y reordénalo así:

1. **What it is and what it is not.** Cuatro líneas: PWA offline-first para profesionales de primera línea; la profesional decide, la herramienta no diagnostica; v1 sin backend; **no apta para datos reales**.
2. **Status.** Tabla honesta: hecho (T1 a T7, con una frase), pendiente (T9 semilla y guion, T7-20 Android real, TR-002), y una línea de «what has not been independently reviewed».
3. **Quick start.** `npm ci` y `npm run dev` (requisitos: Node ≥ 20.19, npm ≥ 10; corrige H7).
4. **Run the demo** (abajo, el corazón de T8).
5. **Test it without a network** (abajo).
6. **Reset the demo.**
7. Commands, repository layout, configuration, installable PWA (lo existente).
8. **Security and privacy at a glance**, con enlaces a `SECURITY.md`, `docs/threat-model.md` y `docs/adr/README.md`, y los **cinco límites más importantes** en una frase cada uno (PIN de 6 dígitos atacable sin conexión si copian el almacenamiento; olvidar el PIN pierde los datos; salida rápida y bloqueo son de mejor esfuerzo; sin menores ni revocación de consentimiento; contenido clínico de muestra sin revisar).
9. Verification record (lo existente) y licencias.

**Run the demo — pasos propuestos.** Verifica cada etiqueta contra `apps/web/src/i18n/es.json` y `en.json` antes de publicarla; los textos de abajo ya se cotejaron con el commit `7a7061e`.

| # | Haz esto | Deberías ver (ES / EN) |
|---|---|---|
| 1 | `npm ci`, `npm run build`, `npm run preview`; abre la URL que imprime (usa `localhost` o `127.0.0.1`) | Pantalla «Crea un PIN» / «Create a PIN» |
| 2 | Crea un PIN de 6 dígitos y confírmalo. Para la demo usa uno cualquiera que no sea una fecha ni una secuencia (por ejemplo `483915`) | Pantalla «Inicio» / «Home» con el aviso «Contenido de demostración. No uses datos reales.» / «Demonstration content. Do not use real data.» |
| 3 | Pulsa «Nuevo caso» / «New case» | Pantalla «Consentimiento informado» / «Informed consent» y un código seudónimo |
| 4 | Marca la casilla de consentimiento y pulsa «Continuar» / «Continue» | Cuestionario «Cuestionario de bienestar (muestra)» / sample questionnaire, «Pregunta 1 de 9» / «Question 1 of 9» |
| 5 | Responde las 9 preguntas con la opción de posición 2, 3, 2, 3, 2, 2, 3, 2, 2 (es decir, valores 1, 2, 1, 2, 1, 1, 2, 1, 1). Pulsa «Siguiente» / «Next» y, en la última, «Finalizar» / «Finish» | **Alerta de seguridad** / «Safety alert», porque la pregunta 9 es mayor que 0 |
| 6 | Pulsa «Entendido» / «Understood» | Resultado: puntuación **12 de 27**, nivel calculado **Moderado** / **Moderate**, y «Qué pesó más» / «What weighed most» con las preguntas 2, 4 y 7 |
| 7 | Cambia el nivel final a otro y comprueba que «Guardar» / «Save» no se habilita sin un motivo escrito; escribe el motivo y guarda | «Detalle del caso» / «Case detail» con «Alerta de seguridad activada» / «Safety alert triggered» |
| 8 | Pulsa «Ver ruta de remisión» / «View referral route» | Ruta prioritaria primero, servicios **de muestra** con «Última verificación: SAMPLE-DD-MM-AAAA» / «Last verified: SAMPLE-DD-MM-AAAA» |
| 9 | Pulsa «Salida rápida» / «Quick exit» | Pantalla neutral «Notas» / «Notes» («No hay notas.» / «No notes.»), sin nombre de la app |
| 10 | Vuelve a abrir la app e introduce el PIN | La app está bloqueada; al desbloquear, el caso sigue ahí (cifrado en el dispositivo) |

**Test it without a network.** El service worker **no se registra con `npm run dev`** (`devOptions: { enabled: false }` en `vite.config.ts`), así que la prueba sin red usa el build: tras el paso 1 y la primera carga con red, espera el estado «Lista para usar sin conexión» / «Ready to use offline» en la pantalla de bloqueo, activa «Offline» en las herramientas de desarrollo del navegador (o el modo avión en el teléfono), recarga y repite los pasos 2 a 10. Indica las limitaciones reales: la primera carga debe ser con red y sobre HTTPS, `localhost` o `127.0.0.1`.

**Reset the demo.** Cómo borrar los datos del sitio (y desregistrar el service worker) en Chrome/Edge, y la advertencia de que **olvidar el PIN no tiene recuperación** en v1. No prometas una función de borrado que no existe.

**Criterio:** el README debe permitir que alguien que no conoce el proyecto complete los pasos 1 a 10 sin ayuda (ver sección 7).

### 6.3 Modelo de amenazas (8b)

Reorganiza `docs/threat-model.md` con esta estructura. **Escribe cada fila a partir del código y las pruebas**, no de memoria ni copiando este esqueleto.

1. **Encabezado.** Versión, fecha, alcance, y la línea de estado: «Internal review v1 (T8). Not an independent security audit. Not suitable for real personal data.». Quita el texto de «placeholder» del final.
2. **Sistema y fronteras de confianza.** Un diagrama (Mermaid, que GitHub renderiza) con: profesional → PWA en el navegador → {IndexedDB cifrada, Cache Storage con archivos del build, `localStorage` con ajustes, memoria volátil}; el alojamiento estático interviene solo en la primera carga y en las actualizaciones; no hay backend. Lista de fronteras: navegador/SO, alojamiento, cadena de suministro de dependencias.
3. **Qué se guarda y dónde.** Tabla: dato → lugar → ¿cifrado? → ¿visible a quien inspeccione el teléfono?. Incluye lo que **no** se usa (cookies, `sessionStorage`, URL, registros). Cada celda debe poder comprobarse en el código o en la prueba O5 de Playwright.
4. **Activos.** Los seis actuales, más la existencia misma de la app en el teléfono (nombre, ícono, base `saviatech`, precaché) como activo a proteger.
5. **Adversarios.** A1 persona hostil con acceso breve a un teléfono desbloqueado. **A2 persona hostil que conoce el PIN o puede obligar a entregarlo (nuevo).** A3 persona con tiempo y el teléfono bloqueado que copia el almacenamiento. A4 pérdida o robo. A5 dependencia comprometida. **A6 quien controla el alojamiento o publica una actualización maliciosa (nuevo).** A7 entorno de demostración (pantalla compartida, grabación). A8 fallos no maliciosos: expulsión de almacenamiento, error de puntaje, contenido clínico mal cargado.
6. **Registro de amenazas.** Una fila por amenaza con IDs `T-01…` y las columnas: *Amenaza · Adversario · Activo · Controles actuales (ruta de código) · Prueba que lo demuestra · Riesgo residual · Decisión o responsable · Estado*. Siembra al menos estas, migrando las filas existentes y añadiendo las nuevas:
   - ya existentes: teléfono desbloqueado inspeccionado; copia de almacenamiento y fuerza bruta del PIN; fuga por la plataforma; manipulación de registros; manipulación de la metainformación de bloqueo; dependencia comprometida; pérdida del dispositivo; hombro durante la demo;
   - **nuevas a evaluar:** coacción o conocimiento del PIN (los controles de la app no la mitigan; escríbelo así); alojamiento o actualización maliciosa (el service worker y el JS salen del mismo origen; qué mitigan HTTPS y el aviso de actualización y qué no); incrustación en un marco (H9); XSS (ausencia de `innerHTML`/`eval`, `script-src 'self'`, escape de React; sin prueba automatizada específica, dilo); alteración del contenido clínico en el build o el despliegue (validación al inicio, etiqueta `SAMPLE`; no hay firma); uso con menores; ruta de remisión desactualizada o inventada; falsa tranquilidad por nivel bajo con riesgo real (la herramienta no diagnostica, la decisión es de la profesional).
7. **Límites conocidos.** Conserva los actuales, agrupados por tema, y para cada uno di si es *aceptado en v1*, *planificado* (con tarea) o *abierto* (con responsable).
8. **Registro de riesgo residual** de los cinco más importantes, cada uno con responsable y la decisión que falta. Incluye D3 (base `saviatech`), D6 (cambio de PIN) y la alerta que solo aparece tras la última pregunta (T6 D3, decisión de Trabajo Social).
9. **Cómo se hizo esta revisión y qué no cubre.** Qué se leyó, qué se ejecutó; sin prueba de penetración, sin revisión independiente, sin pruebas en teléfono real, sin revisión legal. Menciona que la Ley 1581 de 2012 y la evaluación de impacto de privacidad están pendientes de revisión por una abogada o un abogado.
10. **Apéndice A. Controles implementados por tarea (T3 a T7).** El texto actual, sin perder contenido, corregido donde un control haya cambiado.

**Importante sobre H9:** antes de afirmar que `frame-ancestors` no se aplica desde `<meta>`, confírmalo en la documentación vigente de CSP (MDN o la especificación) y cítala. Si se confirma, la recomendación de cabeceras del alojamiento (`Content-Security-Policy: frame-ancestors 'none'`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`) pasa al README y al ADR-0012 como **recomendación de despliegue**, no como algo que la app ya hace.

### 6.4 SECURITY.md (8c)

- Reescribe «Current implementation» para cubrir T3 a T7: clave derivada del PIN y cifrado por registro; repositorio cifrado; bloqueo automático y al ocultarse la página; salida rápida; CSP; sin llamadas de terceros; service worker con precaché solo de archivos del build; manifiesto neutral. Cada frase con su archivo o ADR.
- Añade: versiones soportadas («solo `main`; sin versiones publicadas»), el compromiso de acuse de recibo (D6), qué hacer si el reporte contiene datos personales, y aviso de que **v1 no es apto para datos reales**.
- Si Q3 se responde a favor, añade GitHub Private Vulnerability Reporting como canal y cambia los correos en `SECURITY.md` y `CODE_OF_CONDUCT.md` a la vez, para que no queden dos versiones distintas.
- No prometas lo que el equipo no pueda cumplir (plazos de corrección, recompensas, divulgación coordinada con fechas) sin que una persona lo apruebe.

### 6.5 ADRs (8d)

Formato: el de `0000-template.md` más la línea `Task:` y, cuando aplique, `Supersedes:`. Estado: `proposed`, `accepted`, `superseded` o `deprecated` (D9). Fecha: la real.

**Índice `docs/adr/README.md`:** tabla con número, título, estado, fecha y tarea; la leyenda de estados; y la regla «una decisión aceptada no se edita: se reemplaza con un ADR nuevo».

**Correcciones de metadatos:** añade `Task: TR-001 T6` a 0007 y `Task: TR-001 T7` a 0008. No toques sus decisiones.

**ADR nuevos (cada uno corto, en inglés, con «Alternatives considered»):**

| ADR | Título | Contenido mínimo | Estado por defecto |
|---|---|---|---|
| 0009 | Database name and visible footprint | El nombre `saviatech`, la tabla `cases` y `actualizadoEn` son visibles; la decisión D3; por qué renombrar tras el primer uso huérfana los vaults; lo que sigue visible aunque se renombre (número de casos, recencia, tamaños, el nombre de la app instalada) | `proposed` hasta que Q2 se responda; si se acepta «documentar como límite», `accepted` |
| 0010 | Demo instrument and clinical content policy | Instrumento de muestra de estilo PHQ-9 con 9 ítems y `licenceStatus: to-verify`; EPDS no se usa hasta verificar su licencia; todo texto clínico, de crisis, de consentimiento y las rutas son `SAMPLE` y requieren revisión de Trabajo Social; el ítem de seguridad (índice 8) y el umbral; la herramienta no diagnostica | `accepted` (ya es el valor por defecto de TR-001 §11) |
| 0011 | v1 scope: frontend only, no backend | Por qué no hay backend, cuentas ni sincronización en v1; qué implica (sin respaldo, sin recuperación, sin métricas); relación con TR-002 | `accepted` |
| 0012 | CSP in `<meta>` and hosting headers | Por qué la CSP está en `index.html`; qué directivas no aplican desde `<meta>`; cabeceras recomendadas al alojar; relajaciones registradas (ninguna, salvo el orden de hojas de estilo de ADR-0006) | `proposed` hasta confirmar H9 |
| 0013 | PIN policy and deferred PIN change | Mínimo de 6 dígitos y por qué; sin rechazo de PIN triviales ni frase de paso en v1; D6 (sin cambio de PIN en la UI) y qué hacer hoy si alguien conoce el PIN; ruta a una frase de paso | `proposed` |

### 6.6 Higiene del repositorio (8e)

Solo con respuesta humana (sección 10):

- **`.opencode/` (Q1).** Según la decisión, o se deja de versionar y se ignora, o se conserva con su licencia, atribución y mención en `LICENSE` y en el diseño de carpetas de `AGENTS.md`. Cualquiera sea la decisión, el resumen de `LICENSE` debe decir qué hay en el árbol.
- **T7 duplicado (H6).** Marca cuál es el requerimiento canónico y enlaza el otro como histórico, o fusiónalos. No borres ninguno sin avisar.
- **`.gitignore` (H8).** Añade `.env` y `.env.*` con excepción explícita de `apps/web/.env` si se quiere seguir versionando el valor por defecto; o mueve el valor a `.env.example`.
- **Erratas (H7).** `README` (versión de Node), `AGENTS.md` (título de «Commands»), `TR-001` (estado «T1–T8 implemented; T9 next» **solo cuando T8 esté terminada**).

### 6.7 Verificador de documentación (8f, opcional)

Un script `scripts/check-docs.mjs` sin dependencias (cabecera SPDX `MIT`, como el resto de `scripts/`) y el comando `npm run docs:check`, que falle si:

1. un `npm run <x>` citado en `README.md`, `CONTRIBUTING.md` o `AGENTS.md` no existe en el `package.json` raíz;
2. un enlace relativo de un `.md` no apunta a un archivo existente;
3. un ADR no tiene `Status`, `Date`, `Task` (salvo 0000 y los ADR de proceso) o no aparece en `docs/adr/README.md`;
4. `docs/threat-model.md` contiene «placeholder» o «Needs review in T8».

Si se añade, súmalo al job `verify` de CI. Si no hay tiempo, no se hace y se deja en «Pendiente».

---

## 7. Criterios de aceptación

Todos deben poder comprobarse.

1. **Clonación limpia.** Una persona que no escribió el código (propuesta: la Directora Psicosocial, Q7) clona el repositorio en una carpeta nueva, con un perfil de navegador limpio, sigue **solo el README** y completa los pasos 1 a 10 en **menos de 10 minutos**. Se registra en el README: fecha, sistema operativo, versión de Node, navegador, resultado y tiempo.
2. La prueba sin red (sección 6.2) funciona siguiendo el README, y el README explica por qué no funciona con `npm run dev`.
3. `docs/threat-model.md` no contiene «placeholder» ni «Needs review in T8»; tiene la estructura de 6.3; **cada control citado tiene ruta de código**, y cada fila dice si tiene prueba automatizada o no.
4. Las filas nuevas (coacción/PIN conocido, alojamiento o actualización maliciosa, incrustación, XSS, contenido clínico, menores) existen, con su riesgo residual y responsable.
5. El modelo de amenazas declara explícitamente que es una revisión interna, sin auditoría independiente, sin prueba en teléfono real y sin revisión legal.
6. `SECURITY.md` describe lo implementado de T3 a T7, con versiones soportadas, compromiso de respuesta y aviso de no apto para datos reales; sus correos coinciden con `CODE_OF_CONDUCT.md`.
7. Existe `docs/adr/README.md` y lista **todos** los ADR; 0007 y 0008 tienen `Task:`; existen 0009, 0010 y 0011 (y 0012 y 0013 si hay tiempo); ningún ADR aceptado fue editado en su decisión.
8. Ninguna decisión humana queda marcada `accepted` sin que una persona la haya confirmado.
9. `README.md`, `AGENTS.md` y `CONTRIBUTING.md` son coherentes entre sí en comandos y versiones; `TR-001` refleja el estado real.
10. Ninguna afirmación nueva contradice el código: se hizo un cotejo de las cifras y constantes citadas (iteraciones, esperas, tamaños, presupuestos) contra `apps/web/src/crypto/constants.ts`, `bundle-budget.json` y la salida de `npm run budget`.
11. Se resolvió o se registró con responsable el tema de `.opencode/` (H5) y el de los dos archivos de T7 (H6).
12. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run budget` y `npm run licenses` siguen pasando; **no cambió ningún archivo de `apps/web/src/` ni de `packages/rules/src/`** (salvo D3 aprobada). Si se añadió `docs:check`, también pasa.
13. El último resultado de `npm run e2e` en CI está verde (lo confirma una persona; no se puede inferir desde un entorno sin navegador).

---

## 8. Documentación que debe actualizar T8

- `docs/specs/TR-001-vertical-slice.md`: encabezado y §9 con «T8 implemented; T9 next», y una nota breve de lo que T8 dejó (como se hizo con T5 a T7).
- `AGENTS.md`: título de «Commands», diseño de carpetas (según Q1) y enlace al índice de ADR.
- `CONTRIBUTING.md`: sección corta «Documentation changes» (qué debe actualizarse cuando cambia un control de seguridad: threat model, SECURITY, ADR) y `npm run docs:check` si existe.
- `docs/threat-model.md`: ya cubierto; quita «updated in TR-001 tasks T3…T7. Needs review in T8».
- `README.md`: ya cubierto; actualiza «Status» al terminar.

---

## 9. Forma de trabajo

Una rama: `docs/t8-documentacion` (convención de `AGENTS.md`). Un commit por paso, con tipo en inglés y descripción en español, por ejemplo `docs(readme): agrega los pasos de la demostración`.

1. **Plan primero.** Presenta el plan, los supuestos y las dudas y **espera aprobación**. Reconfirma la sección 4 (vuelve a ejecutar `npm ci`, lint, typecheck, test, build y budget) antes de escribir.
2. **8a. README.** Estructura 6.2, pasos de demo cotejados con `es.json` y `en.json`. Haz la clonación limpia en una carpeta aparte y anota lo que falló.
3. **8b. Modelo de amenazas.** Estructura 6.3. Antes de cada afirmación de control, abre el archivo citado. Confirma H9 en la documentación oficial y cítala.
4. **8c. SECURITY.md.**
5. **8d. ADRs.** Índice, metadatos, 0009 a 0011; luego 0012 y 0013.
6. **8e. Higiene.** Solo lo que las respuestas de la sección 10 permitan.
7. **8f. Verificador.** Solo si sobra tiempo.
8. **Cierre.** Ejecuta las seis comprobaciones del criterio 12, confirma con `git diff --stat` que no tocaste código, y termina con: qué cambió, qué te dejó dudas, qué necesita una decisión humana (en particular D3, D8, Q1 a Q4) y **qué quedó sin comprobar** (e2e en CI, Android real, revisión legal e independiente).

No marques T8 como terminada sin el criterio 1 cumplido por otra persona.

---

## 10. Preguntas abiertas para el equipo (respóndelas antes de 8a si es posible)

| # | Pregunta | Responsable | Por defecto si no hay respuesta |
|---|---|---|---|
| Q1 | ¿`.opencode/` (441 archivos de un kit de terceros) se queda en el repositorio público o se deja de versionar? | Director técnico | No se toca; se deja registrado como pendiente y se avisa en el cierre |
| Q2 | ¿El nombre de la base pasa a `VITE_DB_NAME` ahora o se documenta como límite? | Director técnico | Documentar como límite (ADR-0009) |
| Q3 | ¿Siguen los correos personales en `SECURITY.md` y `CODE_OF_CONDUCT.md`, o se usa un alias del proyecto o GitHub Private Vulnerability Reporting? | Ambos | Se mantienen y se registra la pregunta |
| Q4 | ¿Qué compromiso de respuesta pueden cumplir (¿7 días de acuse?) | Ambos | 7 días naturales, sin plazos de corrección |
| Q5 | ¿El README es solo en inglés o se añade una guía de demo en español para jurado y comunidad? | Ambos | Solo inglés, con etiquetas en español en los pasos |
| Q6 | ¿El repositorio de GitHub ya es público y desde cuándo lo será? Cambia la urgencia de Q1 y Q3 | Ambos | Se asume que será público el 2026-11-03 |
| Q7 | ¿Quién hace la clonación limpia (criterio 1)? | Ambos | La Directora Psicosocial, si puede |
| Q8 | ¿El cambio de PIN entra en v1 o en TR-002? (D6) | Director técnico | TR-002; se documenta en ADR-0013 |
| Q9 | ¿Se mide T7-20 en un Android real antes del vídeo? | Equipo | Queda pendiente y declarada en el README |

---

## 11. Pendiente para otras tareas (no hacer ahora)

- **T9:** datos sintéticos de demostración (semilla solo en desarrollo, todo `synthetic: true`) y el guion de 2 minutos ejecutable de extremo a extremo.
- **Vídeo de 2 minutos** con el equipo real y el producto funcionando en un teléfono, en modo avión.
- **T7-20:** medición en un Android de gama baja (modelo y resultado en el README).
- **TR-002:** backend autoalojable, sincronización por registro de eventos, panel público con datos agregados y anonimizados con umbrales mínimos, exportación agregada a DHIS2.
- Revisión de seguridad independiente; evaluación de impacto de privacidad y revisión legal (Ley 1581 de 2012); protocolo para menores; política de borrado y revocación de consentimiento.
- Revisión de Trabajo Social de todo el contenido `SAMPLE`; verificación de licencias de instrumentos (EPDS, PHQ-9, GAD-7) antes de usarlos.
- Alerta de seguridad al responder el ítem (T6 D3), pausa y reanudación cifrada de un tamizaje, coordinación entre pestañas, anti-rollback, frase de paso en lugar de PIN, cambio de PIN en la UI.
- Verificación del comportamiento de almacenamiento en iOS Safari frente a la documentación vigente de WebKit.
