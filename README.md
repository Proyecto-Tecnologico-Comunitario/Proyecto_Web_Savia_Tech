# SaviaTech

SaviaTech is an offline-first progressive web app for frontline social workers. It supports
pseudonymous psychosocial risk screening, consent capture, explainable results and local referral
pathways. The professional makes every decision; the tool never diagnoses.

This repository contains the **frontend only**. A backend, if needed, lives in a separate repository
and is not part of v1. See `docs/specs/TR-001-vertical-slice.md` for the current scope.

> Status: rules engine, local encryption, encrypted case storage, the UI shell, the case flows and the
> installable offline PWA (TR-001 tasks T2-T7). Instrument validation, scoring, bands, the safety
> alert, PIN-derived keys, encrypted records, the case repository, PIN setup/unlock, automatic lock,
> quick exit, Spanish/English text, settings, consent, screening, result, case detail, the suggested
> referral route, the service worker, the web manifest and the offline tests exist with tests.
> Nothing in this repository is ready for real personal data.

## Requirements

- Node.js 20.19 or newer (see `.nvmrc`)
- npm 10 or newer

## Getting started

```sh
npm ci
npm run dev
```

The development server prints a local URL. The app offers PIN setup/unlock, a case list, new case with
layered consent, screening, safety alert, result, case detail, a suggested referral route and settings.
All content is synthetic and marked `SAMPLE`.

## Commands

```sh
npm run dev        # start the web app
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
docs/                  specifications, design reference, threat model, ADRs
scripts/               repository tooling (licences, icons, build budget)
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
background and shows "Actualización disponible" on the lock screen and in Settings. The update is
blocked while the vault is unlocked; lock the vault and press "Actualizar" to reload into the new
version. Case data stays encrypted in IndexedDB across the update.

For a local Android test without a public HTTPS host, map the preview port and open `127.0.0.1` on the
phone:

```sh
adb reverse tcp:4173 tcp:4173
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Recommended static-hosting headers:

- `sw.js` and `index.html`: `Cache-Control: no-cache` (the worker and the shell must be revalidated).
- `/assets/*`: long-lived immutable caching; the file names are content hashes.
- `manifest.webmanifest`: `Content-Type: application/manifest+json`.
- HTTPS with a valid certificate. No `Service-Worker-Allowed` header is needed because the worker is
  served from the root scope.

Build measurements (2026-11-02, `npm run budget`):

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
  notice appeared on the lock screen with the "Actualizar" button; while unlocked, Settings showed
  "Se aplicará al bloquear" and no button. After locking and pressing "Actualizar", the page reloaded
  into v2 and the saved case was still there. Browser: Chromium bundled with Playwright; no console
  or page errors.
- **T7-20 low-end Android, pending.** Not claimed as done; record the model and the result here after
  a real measurement in airplane mode.

## Safety and privacy rules

- Synthetic data only. Never commit real personal data, screenshots or logs.
- Sensitive case data lives only in the encrypted store, never in URLs, logs or analytics.
- The PIN, KEK and DEK are never stored in clear, logged or sent to a network.
- No third-party runtime network calls, CDNs, remote fonts or telemetry.
- Clinical content is placeholder data marked `SAMPLE` and requires Social Work review.

Read `AGENTS.md` and `SECURITY.md` before contributing.

## Licences

- `packages/rules/` and tooling: MIT
- `apps/web/`: GPL-3.0-or-later
- `content/` and `docs/`: CC-BY-4.0

See `LICENSE` for the overview and each component for the full text.
