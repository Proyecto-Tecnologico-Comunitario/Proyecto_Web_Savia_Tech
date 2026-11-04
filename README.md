# SaviaTech

## What it is and what it is not

SaviaTech is an offline-first progressive web app (PWA) for frontline social workers and community
agents. It supports pseudonymous psychosocial risk screening, consent capture, explainable results
and local referral pathways. The professional makes every decision; the tool never diagnoses.

This repository contains the **frontend only**. v1 has no backend, accounts or synchronisation; a
backend, if needed, is TR-002 and lives in a separate repository. **It is not suitable for real
personal data**: all clinical content is synthetic, marked `SAMPLE` and pending Social Work review.

## Status

| Area   | State                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| T1     | Repository, workspaces, tooling, CI, licences and documentation skeleton are in place.                            |
| T2     | The pure rules engine validates the instrument, scores answers, assigns bands and raises the safety alert.        |
| T3     | The PIN-derived key hierarchy, wrapped data key and per-record encryption are implemented and tested.             |
| T4     | Cases are stored encrypted in IndexedDB through a repository with optimistic updates and paging.                  |
| T5     | The UI shell, in-memory router, PIN setup/unlock, automatic lock, quick exit, i18n and settings work.             |
| T6     | New case, consent, screening, safety alert, result, case detail and the suggested referral route work.            |
| T7     | The generated service worker, neutral manifest, update notice, build budget and offline tests are in place.       |
| T8     | Documentation pass complete: README, threat model, security policy and ADR index. Clean-clone acceptance pending. |
| T9     | **Pending.** Synthetic demo seed and the executable 2-minute demo script.                                         |
| T7-20  | **Pending.** Measurement on a real low-end Android phone in airplane mode.                                        |
| TR-002 | **Not started.** Self-hostable backend, synchronisation, aggregated dashboard and DHIS2 export.                   |

What has not been independently reviewed: the code has had an internal review only, not an
independent security audit, penetration test, legal review or privacy impact assessment. It has not
been tested on a real phone. See `docs/threat-model.md`.

## Requirements

- Node.js 20.19 or newer (see `.nvmrc`, which pins Node 20)
- npm 10 or newer

## Quick start

```sh
npm ci
npm run dev
```

The development server prints a local URL (usually `http://localhost:5173`). The app offers PIN
setup/unlock, a case list, a new case with layered consent, screening, safety alert, result, case
detail, a suggested referral route and settings. All content is synthetic and marked `SAMPLE`.

`npm run dev` does **not** register the service worker (`devOptions.enabled` is `false` in
`apps/web/vite.config.ts`). To test offline behaviour, use the production build as described below.

## Run the demo

This walkthrough takes about five minutes on a desktop browser or an Android phone. It uses only
synthetic data. The UI opens in Spanish; the English label is shown in parentheses.

1. Install and build, then serve the production build:

   ```sh
   npm ci
   npm run build
   npm run preview --workspace @saviatech/web
   ```

   The root `package.json` has no `preview` script; the command above runs the one in `apps/web`.
   Open the printed URL (usually `http://localhost:4173`). Use `localhost` or `127.0.0.1`: service
   workers and Web Crypto are not available in an insecure context.

2. Create a six-digit PIN and confirm it. For the demo use a value that is not a date or a sequence,
   for example `483915`.
   You should see **Inicio** (**Home**) with the banner **Contenido de demostración. No uses datos
   reales.** (**Demonstration content. Do not use real data.**).

3. Press **Nuevo caso** (**New case**).
   You should see **Consentimiento informado** (**Informed consent**) and the sample consent text.

4. Tick the consent checkbox and press **Continuar** (**Continue**).
   The case is created at this point. You should see the screening screen with a pseudonymous code
   (for example `K7QM-3XPA`), **Pregunta 1 de 9** (**Question 1 of 9**) and the sample questionnaire.

5. Answer the nine questions with the option in position `2, 3, 2, 3, 2, 2, 3, 2, 2` (that is,
   values `1, 2, 1, 2, 1, 1, 2, 1, 1`). Press **Siguiente** (**Next**) after each one and
   **Finalizar** (**Finish**) on the last.
   You should see **Alerta de seguridad** (**Safety alert**), because question 9 has a value greater
   than 0.

6. Press **Entendido** (**Understood**).
   You should see **Resultado** (**Result**), **Puntuación: 12 de 27** (**Score: 12 of 27**),
   **Nivel calculado: Moderado** (**Calculated level: Moderate**) and **Qué pesó más** (**What
   weighed most**) listing questions 2, 4 and 7.

7. Change **Nivel final** (**Final level**) to a different band. **Guardar** (**Save**) stays
   disabled until you write a reason in **Justificación del cambio** (**Reason for the change**).
   Write a synthetic reason and press **Guardar** (**Save**).
   You should see **Detalle del caso** (**Case detail**) with the pseudonymous code and **Alerta de
   seguridad activada** (**Safety alert triggered**).

8. Press **Ver ruta de remisión** (**View referral route**).
   You should see the priority notice, the priority sample service first and **Última verificación:
   SAMPLE-DD-MM-AAAA** (**Last verified: SAMPLE-DD-MM-AAAA**). The services are samples.

9. Press **Salida rápida** (**Quick exit**).
   You should see the neutral screen **Notas** (**Notes**) with **No hay notas.** (**No notes.**)
   and no app name. The vault is locked before the neutral screen is shown.

10. Reopen the app URL and enter the PIN.
    You should see the unlock screen first; after unlocking, the case and its screening are still
    there, stored encrypted on the device.

## Test it without a network

The service worker is generated only in the production build. After the first online load of the
preview server, open **Ajustes** (**Settings**) and wait for **Lista para usar sin conexión**
(**Ready to use offline**). That status is shown in Settings, not on the lock screen.

Then enable **Offline** in the browser developer tools (Application > Service Workers > Offline) or
turn on airplane mode on the phone, reload, and repeat steps 2 to 10. The first load must be online
and served over HTTPS, `localhost` or `127.0.0.1`; after that the app shell, assets and sample
content are served from the precache.

The full Playwright suite covers the same offline paths: installation, cold start without network,
the full flow offline, first use offline, cache contents and installability. See
`apps/web/e2e/`.

## Reset the demo

The app has no in-app delete or reset button in v1. To start over, clear the site data:

- **Chrome or Edge on desktop:** open Developer tools > Application > Storage > Clear site data, or
  use the site information panel in the address bar and delete the site data.
- **Android:** open the browser settings for the site and clear storage, or uninstall the installed
  PWA and clear the browser site data.

Clearing site data deletes the encrypted vault, all cases and the service-worker cache. **If you
forget the PIN, the data on the device cannot be recovered in v1.** There is no recovery phrase,
backup or account.

## Commands

```sh
npm run dev        # start the web app (no service worker)
npm run lint       # ESLint plus Prettier check
npm run typecheck  # tsc --noEmit for every workspace
npm test           # Vitest unit tests (rules, crypto, storage, session and UI)
npm run e2e        # Playwright end-to-end tests (build, preview, offline and installability)
npm run build      # production build of the web app
npm run budget     # build audit and size budget (run after npm run build)
npm run licenses   # fail on missing or non-permissive dependency licences
npm run icons      # regenerate the PNG icons from the SVG sources
npm run format     # write Prettier formatting
```

There is no root `preview` script. To serve a build locally, run
`npm run preview --workspace @saviatech/web`.

`npm run e2e` covers the T5 lock and quick-exit flows, the T6 case flows (with and without a safety
alert, justification, lock mid-screening, quick exit, language switching and CSP) and the T7 offline
flows (service worker installation, cold start without network, the full flow offline, first use
offline, cache contents and installability). Install Chromium once with `npm run e2e:install`.
Performance measurements are informative and run only when `PERF=1` is set; see
`apps/web/e2e/perf.spec.ts`.

## Repository layout

```text
apps/web/              React + Vite PWA
apps/web/src/crypto/   PIN-derived key hierarchy and record encryption
apps/web/src/model/    case payload types and runtime validation
apps/web/src/storage/  Dexie database, encrypted case repository and persistence helpers
apps/web/src/session/  vault controller, automatic lock, quick exit and volatile state
apps/web/src/content/  startup validation of instrument, consent and referral files
apps/web/src/flows/    pure reducers for new case, screening and screening entry
apps/web/src/pwa/      service-worker status, registration and web manifest
apps/web/src/router/   in-memory router
apps/web/src/ui/       shell, screens and accessible components
apps/web/public/icons/ neutral SVG and PNG icons used by the manifest
apps/web/e2e/          Playwright lock, quick-exit, case-flow, offline, installability and CSP tests
packages/rules/        pure TypeScript validation, scoring and safety rules
content/               versioned clinical content (SAMPLE data only)
docs/                  specifications, design reference, threat model and ADRs
scripts/               repository tooling (licences, icons, build budget)
.opencode/             third-party agent toolkit, not part of the app (pending repository-hygiene decision)
```

The rules engine exposes `validateInstrument`, `validateAnswers`, `scoreAnswers`, `bandForScore`,
`hasSafetyAlert` and `evaluateScreening`.

The crypto module derives a KEK from the PIN with PBKDF2-HMAC-SHA256, wraps a random AES-GCM data key
with AES-KW and encrypts every record with its own IV and AAD. Read
`apps/web/src/crypto/README.md` and `docs/adr/0003-local-encryption.md` before changing it.

Cases live only encrypted in IndexedDB. The `saviatech` database keeps `cryptoMetadata` and `cases`;
each case row exposes only `id`, `v`, `iv`, `ct` and `actualizadoEn`. Read
`docs/adr/0005-case-storage.md` before changing the repository or the schema.

The UI shell, in-memory router, automatic lock, quick exit and settings decisions are recorded in
`docs/adr/0006-ui-shell.md`. The consent, screening, result, case-detail and referral decisions are
recorded in `docs/adr/0007-case-flows.md`.

Code comments and JSDoc are in Spanish for the security audit. Repository documentation, identifiers,
error messages and test names are in English. See `docs/adr/0004-language-conventions.md`.

`docs/design/savia_demo.html` is a visual and copy reference only. Its code is not reused.

## Configuration

The app name is build-time configuration. `VITE_APP_NAME` defaults to `SaviaTech`;
`VITE_APP_SHORT_NAME` defaults to the app name (maximum 45 characters); `VITE_BASE_PATH` defaults to
`/`. The web manifest cannot change after installation, so a deployment that needs a neutral name or
a subpath must set these variables when building. The manifest validation fails the build when a name
is empty, too long or contains a sensitive term.

```sh
VITE_APP_NAME="SaviaTech" VITE_APP_SHORT_NAME="SaviaTech" VITE_BASE_PATH="/" npm run build
```

The icons live in `apps/web/public/icons/`. Replace the SVG sources and run `npm run icons` to
regenerate the PNGs, then commit both. The manifest declares a 192 px icon, a 512 px icon and a
maskable 512 px icon; keep those sizes.

## Installable PWA and offline use

The first load must be online and served over HTTPS, `localhost` or `127.0.0.1`; service workers and
Web Crypto are not available in an insecure context. After that first load the app shell, assets and
clinical content are precached, and the whole flow works without network.

There is no custom install button. Install from the browser menu ("Install app" or "Add to Home
Screen"). The installed name and icon are visible on the home screen and in the app switcher.

Updates are prompted, never silent. After a new build is deployed, the next load downloads it in the
background and shows **Actualización disponible** (**Update available**) on the lock screen and in
Settings. The update is blocked while the vault is unlocked; lock the vault and press **Actualizar**
(**Update**) to reload into the new version. Case data stays encrypted in IndexedDB across the
update.

For a local Android test without a public HTTPS host, map the preview port and open `127.0.0.1` on
the phone:

```sh
adb reverse tcp:4173 tcp:4173
npm run build
npm run preview --workspace @saviatech/web -- --host 127.0.0.1 --port 4173
```

Recommended static-hosting headers (deployment configuration, not something the app sets itself):

- `Content-Security-Policy: frame-ancestors 'none'`. A CSP delivered in a `<meta>` element cannot
  apply `frame-ancestors`; this header is the only way to refuse framing. See
  `docs/adr/0012-csp-and-hosting-headers.md`.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: no-referrer`.

The app also ships a CSP in `apps/web/index.html` as a defence in depth for static hosts that cannot
set headers. That `<meta>` CSP cannot apply `frame-ancestors`, `report-uri` or `sandbox`.

Cache headers:

- `sw.js` and `index.html`: `Cache-Control: no-cache` (the worker and the shell must be revalidated).
- `/assets/*`: long-lived immutable caching; the file names are content hashes.
- `manifest.webmanifest`: `Content-Type: application/manifest+json`.
- HTTPS with a valid certificate. No `Service-Worker-Allowed` header is needed because the worker is
  served from the root scope.

Build measurements (2026-11-03, `npm run budget`):

| Metric               | Actual    | Budget      |
| -------------------- | --------- | ----------- |
| Initial JS (gzip 9)  | 126,449 B | 256,000 B   |
| Initial CSS (gzip 9) | 1,545 B   | 30,720 B    |
| `index.html`         | 969 B     | 4,096 B     |
| `sw.js`              | 15,762 B  | 40,960 B    |
| Precache (12 files)  | 436,541 B | 1,048,576 B |

Verification record:

- **T7-16 update flow, passed on 2026-11-02.** Built v1, served it on `http://127.0.0.1:4180`,
  created a vault and saved a screening, changed a visible text, rebuilt v2 and reloaded. The update
  notice appeared on the lock screen with the **Actualizar** button; while unlocked, Settings showed
  **Se aplicará al bloquear** and no button. After locking and pressing **Actualizar**, the page
  reloaded into v2 and the saved case was still there. Browser: Chromium bundled with Playwright; no
  console or page errors.
- **T7-20 low-end Android, pending.** Not claimed as done; record the model and the result here after
  a real measurement in airplane mode.
- **T8 documentation checks, passed on 2026-11-03.** `npm ci`, `npm run lint`, `npm run typecheck`,
  `npm test` (275 tests: 224 web + 51 rules), `npm run build`, `npm run budget`, `npm run licenses`
  and `npm run e2e` (28 Chromium tests) passed. The first parallel unit run hit a 5 s timeout in
  `caseRepository.test.ts` T4-09; the test passed alone and in the rerun. Environment: Windows,
  Node v24.19.0, npm 11.20.0. E2E was not run on a physical phone.
- **T8 clean-clone check, pending.** A person who did not write the code must clone the repository,
  follow this README with a clean browser profile and record the date, operating system, Node
  version, browser, result and elapsed time here.

## Security and privacy at a glance

SaviaTech keeps case data encrypted on the device, derives keys from the PIN with the Web Crypto API,
keeps case data out of URLs, logs, cookies and service-worker caches, and makes no third-party runtime
network calls. It is designed for a context where a phone may be inspected by an abuser, but it is
**not independently audited and not suitable for real personal data**. Read `SECURITY.md`,
`docs/threat-model.md` and `docs/adr/README.md` before relying on any control.

The five most important limits:

1. A six-digit PIN can be attacked offline if someone copies the device storage; PBKDF2 raises the
   cost but does not remove the risk.
2. Forgetting the PIN makes the local data unrecoverable in v1; there is no backup or recovery.
3. Quick exit and lock are best effort: the browser and operating system may retain screenshots,
   history entries or memory that the app cannot erase.
4. v1 cannot detect that a person is a minor and cannot revoke consent or delete a case; only
   synthetic data is acceptable until the minors protocol and the deletion policy exist.
5. All clinical content, crisis text, consent text and referral routes are `SAMPLE` placeholders and
   require Social Work review before any real use.

## Documentation and decisions

- `docs/specs/TR-001-vertical-slice.md`: scope, acceptance criteria and task status.
- `docs/threat-model.md`: threats, controls, evidence, residual risk and pending decisions.
- `docs/adr/README.md`: index of architecture decisions and their status.
- `SECURITY.md`: how to report a vulnerability and what to expect.
- `CONTRIBUTING.md`: contribution workflow and local checks.

## Licences

- `packages/rules/` and tooling: MIT
- `apps/web/`: GPL-3.0-or-later
- `content/` and `docs/`: CC-BY-4.0

See `LICENSE` for the overview, including the third-party `.opencode/` directory, and each component
for the full text.
