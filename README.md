# SaviaTech

SaviaTech is an offline-first progressive web app for frontline social workers. It supports
pseudonymous psychosocial risk screening, consent capture, explainable results and local referral
pathways. The professional makes every decision; the tool never diagnoses.

This repository contains the **frontend only**. A backend, if needed, lives in a separate repository
and is not part of v1. See `docs/specs/TR-001-vertical-slice.md` for the current scope.

> Status: repository scaffold (TR-001 task T1). The lock, case, screening, encryption and PWA flows
> are implemented in later tasks. Nothing in this repository is ready for real personal data.

## Requirements

- Node.js 20.19 or newer (see `.nvmrc`)
- npm 10 or newer

## Getting started

```sh
npm ci
npm run dev
```

The development server prints a local URL. The app is a minimal shell until tasks T5 and T6.

## Commands

```sh
npm run dev        # start the web app
npm run lint       # ESLint plus Prettier check
npm run typecheck  # tsc --noEmit for every workspace
npm test           # Vitest unit tests
npm run build      # production build of the web app
npm run licenses   # fail on missing or non-permissive dependency licences
npm run format     # write Prettier formatting
```

`npm run e2e` and the PWA offline flow arrive in TR-001 task T7.

## Repository layout

```text
apps/web/          React + Vite PWA
packages/rules/    pure TypeScript scoring and safety rules
content/           versioned clinical content (SAMPLE data only)
docs/              specifications, design reference, threat model, ADRs
scripts/           repository tooling
```

`docs/design/savia_demo.html` is a visual and copy reference only. Its code is not reused.

## Configuration

The app name is build-time configuration, `VITE_APP_NAME`, defaulting to `SaviaTech`. A deployment
that needs a neutral name can set it when building. The web manifest cannot change after install.

## Safety and privacy rules

- Synthetic data only. Never commit real personal data, screenshots or logs.
- Sensitive case data will only live in the encrypted store, never in URLs, logs or analytics.
- No third-party runtime network calls, CDNs, remote fonts or telemetry.
- Clinical content is placeholder data marked `SAMPLE` and requires Social Work review.

Read `AGENTS.md` and `SECURITY.md` before contributing.

## Licences

- `packages/rules/` and tooling: MIT
- `apps/web/`: GPL-3.0-or-later
- `content/` and `docs/`: CC-BY-4.0

See `LICENSE` for the overview and each component for the full text.
