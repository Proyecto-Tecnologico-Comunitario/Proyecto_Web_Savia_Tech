# AGENTS.md

Guidance for AI coding agents (Claude Code, OpenCode and others) working in this repository.
Human contributors: see CONTRIBUTING.md.

## Project

SaviaTech is an open-source, offline-first progressive web app (PWA) that helps frontline social
workers and community agents screen for psychosocial risk (gender-based violence, maternal mental
health, trauma) and refer women and girls to local services. It is being prepared for the UNICEF
Venture Fund (Femtech Ventures, Pillar 3: mental wellbeing, safety and protection).

The user is the professional. The woman or girl is not a direct user in v1.
This is a sensitive domain: a phone may be inspected by an abuser. Safety and privacy outrank
features, speed and elegance.

## Non-negotiables

1. Synthetic data only. Never put real personal data in code, tests, fixtures, screenshots or examples.
2. Sensitive data lives only in the encrypted store. Never write it to localStorage, sessionStorage,
   cookies, URLs, console output, logs, analytics or service-worker caches.
3. No third-party network calls at runtime (no CDNs, remote fonts, analytics, telemetry, error reporters).
4. Crypto only through the Web Crypto API. Never invent your own primitives. Never use Math.random for
   anything security-related.
5. The tool supports decisions; it never diagnoses. The professional's final decision is always recorded.
6. Clinical content (instruments, thresholds, crisis texts, referral routes, consent text) lives in
   `content/` as versioned data files and needs Social Work review before release. Do not invent clinical
   content. Placeholders must be marked `SAMPLE` in the file and visibly in the UI.
7. Open source end to end. Do not introduce any proprietary or closed backend, SDK or hosted service.
8. Dependencies: OSI-approved permissive licences only. Pre-approved: react, react-dom, vite,
   vite-plugin-pwa, workbox, dexie, fake-indexeddb (tests only), typescript, vitest, playwright, eslint,
   prettier. Ask before adding anything else, and say why.

## Repository layout

```
AGENTS.md  CLAUDE.md  README.md  LICENSE  SECURITY.md  CONTRIBUTING.md  CODE_OF_CONDUCT.md
docs/specs/        requirements (start with TR-001-vertical-slice.md)
docs/design/       UX reference mock-up (flow and copy only, not code to reuse)
docs/adr/          architecture decision records
docs/threat-model.md
content/           instruments, consent text, referral samples (CC-BY-4.0, each file has metadata)
packages/rules/    pure TypeScript engine: scoring, bands, safety alerts (no DOM, no I/O)
apps/web/          the PWA (React + Vite)
apps/web/src/crypto/  PIN-derived key hierarchy, wrapped data key and record encryption
.github/workflows/ci.yml
```

## Commands (available after task T1 of TR-001)

```
npm ci            install exactly from the lockfile
npm run dev       start the web app
npm run lint      eslint + prettier check
npm run typecheck tsc --noEmit for all workspaces
npm test          unit tests (vitest)
npm run e2e       end-to-end tests (playwright, includes the offline flow; available from T7)
npm run build     production build
npm run licenses  fail on non-permissive dependency licences
```

## Conventions

- TypeScript strict, ES modules, no `any`. Small pure functions. The rules package must stay free of
  DOM, storage and network code.
- All UI strings go in `apps/web/src/i18n/es.json` and `en.json`. No hard-coded user-facing text.
- Repository documentation, identifiers, error messages, test names and Conventional Commit types are
  in English. Commit descriptions are in Spanish, for example `feat(crypto): agrega derivación de la
clave`. The existing Spanish specification in `docs/specs/` stays in Spanish.
- Code comments and JSDoc are in Spanish. Comment non-obvious logic line by line, especially security
  code, so a human auditor can follow each decision without translating.
- One branch per task, named `<type>/t<number>-<slug>`, for example `feat/t3-cifrado` or
  `docs/t8-documentacion`. `<type>` is the Conventional Commit type of the main change. Tests live next
  to the code they cover.
- Accessibility basics on every screen: labels, visible focus, touch targets of at least 44 px,
  WCAG 2.1 AA contrast, works in light and dark mode.
- File headers carry an SPDX licence identifier.

## Licences (defaults; maintainers may change them with an ADR)

- `packages/rules/` and other reusable libraries: MIT
- `apps/web/`: GPL-3.0-or-later
- `content/` and `docs/`: CC-BY-4.0

## How to work

1. Read `docs/specs/TR-001-vertical-slice.md` and the relevant ADRs before touching code.
2. Plan first. For each task, state your plan, assumptions and open questions, and how you will verify
   each acceptance criterion. Wait for approval before large changes.
3. Implement one task at a time. Write tests first for `packages/rules` and the crypto module.
4. Before saying a task is done, run lint, typecheck, tests and build, and report the results honestly.
5. Finish with a short summary: what changed, what you were unsure about, and what needs a human decision.
6. Record architecture decisions in `docs/adr/` (one short file each).
7. Keep the project documentation current when a task changes behaviour, architecture, commands or
   conventions: README, task status in `docs/specs/`, threat model, SECURITY and the relevant ADRs.
8. Do not expand scope, refactor unrelated code or add features that are not in the spec.
   If the spec is ambiguous or seems wrong, ask.

## Never do

- Never commit secrets, keys or real data. Never disable a test or a lint rule to make a task pass.
- Never weaken encryption, the lock behaviour or the content-security policy without a human decision.
- Never claim a feature works without a test or a manual check that shows it.
