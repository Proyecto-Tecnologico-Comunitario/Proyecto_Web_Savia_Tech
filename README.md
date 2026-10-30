# SaviaTech

SaviaTech is an offline-first progressive web app for frontline social workers. It supports
pseudonymous psychosocial risk screening, consent capture, explainable results and local referral
pathways. The professional makes every decision; the tool never diagnoses.

This repository contains the **frontend only**. A backend, if needed, lives in a separate repository
and is not part of v1. See `docs/specs/TR-001-vertical-slice.md` for the current scope.

> Status: rules engine, local encryption, encrypted case storage and the UI shell (TR-001 tasks T2-T5).
> Instrument validation, scoring, bands, the safety alert, PIN-derived keys, encrypted records, the
> case repository, PIN setup/unlock, automatic lock, quick exit, Spanish/English text and settings exist
> with tests. Case flows and the PWA offline flow are implemented in later tasks. Nothing in this
> repository is ready for real personal data.

## Requirements

- Node.js 20.19 or newer (see `.nvmrc`)
- npm 10 or newer

## Getting started

```sh
npm ci
npm run dev
```

The development server prints a local URL. The app currently offers PIN setup/unlock, a provisional
home screen and settings; the case flows arrive in T6.

## Commands

```sh
npm run dev        # start the web app
npm run lint       # ESLint plus Prettier check
npm run typecheck  # tsc --noEmit for every workspace
npm test           # Vitest unit tests (rules, crypto, storage, session and UI)
npm run e2e        # Playwright end-to-end tests (build plus vite preview)
npm run build      # production build of the web app
npm run licenses   # fail on missing or non-permissive dependency licences
npm run format     # write Prettier formatting
```

`npm run e2e` covers the T5 lock and quick-exit flows. The PWA offline flow arrives in TR-001 task T7.
Install Chromium once with `npm run e2e:install`.

## Repository layout

```text
apps/web/              React + Vite PWA
apps/web/src/crypto/   PIN-derived key hierarchy and record encryption
apps/web/src/model/    case payload types and runtime validation
apps/web/src/storage/  Dexie database, encrypted case repository and persistence helpers
apps/web/src/session/  vault controller, automatic lock, quick exit and volatile state
apps/web/src/router/   in-memory router
apps/web/src/ui/       shell, screens and accessible components
apps/web/e2e/          Playwright lock, quick-exit, i18n, settings and CSP tests
packages/rules/        pure TypeScript validation, scoring and safety rules
content/               versioned clinical content (SAMPLE data only)
docs/                  specifications, design reference, threat model, ADRs
scripts/               repository tooling
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
`docs/adr/0006-ui-shell.md`.

Code comments and JSDoc are in Spanish for the security audit. Repository documentation, identifiers,
error messages and test names are in English. See `docs/adr/0004-language-conventions.md`.

`docs/design/savia_demo.html` is a visual and copy reference only. Its code is not reused.

## Configuration

The app name is build-time configuration, `VITE_APP_NAME`, defaulting to `SaviaTech`. A deployment
that needs a neutral name can set it when building. The web manifest cannot change after install.

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
