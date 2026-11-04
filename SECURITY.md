# Security policy

SaviaTech is built for people who may be monitored by an abuser. Treat security and privacy reports
as sensitive. Do not test on a device that contains real case data, and do not send real names, phone
numbers, case notes, screenshots or database copies.

> **v1 is not fit for real personal data.** It uses sample clinical content, has no legal or Social
> Work review, cannot detect a minor or revoke consent, and has no recovery path if the PIN is lost.
> See [Known limitations](docs/threat-model.md#8-known-limitations).

## Supported versions

Only the `main` branch is supported. There are no published releases or versioned support lines. A
report should name the commit you tested. We do not backport fixes to older commits.

## Reporting a vulnerability

Do **not** open a public issue for a vulnerability or for anything that contains personal data.

Email the maintainers privately:

- sergio19855@gmail.com
- jnuryalexandrasuarez@gmail.com

Include:

- the affected commit or branch;
- a description of the issue and the impact you expect;
- reproduction steps that use synthetic data only;
- the browser, operating system and, if relevant, the device model;
- whether you believe the issue affects confidentiality, integrity or availability.

We will acknowledge receipt within **7 calendar days**. We do not promise a fix deadline, a reward or
a coordinated-disclosure date. We will tell you what we can confirm and what needs a human decision.
If we cannot reproduce the issue, we may ask for a minimal synthetic example.

If you accidentally send personal data, say so in the same thread and do not send more. We will
delete the message and any attachment as soon as we can and will not use the data for any other
purpose.

## Scope

In scope:

- encryption at rest and key handling in `apps/web/src/crypto/`;
- the encrypted case repository in `apps/web/src/storage/`;
- PIN lock, auto-lock, lock on page hide and quick exit in `apps/web/src/session/` and
  `apps/web/src/ui/`;
- data leakage into IndexedDB, `localStorage`, URLs, history, logs, analytics or service-worker
  caches;
- content-security-policy, dependency and supply-chain issues;
- offline behaviour, service-worker update behaviour and manifest leaks;
- clinical-content validation that could cause a wrong decision.

Out of scope for v1: backend, accounts, synchronisation, DHIS2, push notifications and multi-device
access. Those are separate requirements and do not exist in this repository.

## Current implementation

The following controls exist in the code today. Each claim names the file or test that supports it.
This is a summary, not a substitute for the full [threat model](docs/threat-model.md).

### Key hierarchy and record encryption (T3)

- PBKDF2-HMAC-SHA256 derives a non-extractable AES-KW key from the PIN, with a random 16-byte salt
  and 600,000 iterations. Code: `apps/web/src/crypto/kdf.ts`, `constants.ts`.
- The AES-KW key wraps a random AES-GCM 256 data key. The data key is stored only wrapped and is
  never handed to callers; callers get a bounded session that re-checks the lock. Code:
  `apps/web/src/crypto/keyring.ts`, `recordCipher.ts`.
- Each record uses a fresh 12-byte IV, a 128-bit tag and `table|id|version` as AAD. A changed
  ciphertext, table, id or version fails authentication. Code: `apps/web/src/crypto/recordCipher.ts`.
- Failed attempts are persisted with waits of 0, 0, 5 seconds, 30 seconds and 5 minutes. A lock
  during an unlock prevents that unlock from publishing a key. Code: `keyring.ts`.
- Tests cover wrong PINs, tampered ciphertext, changed AAD, unique IVs, non-extractable keys,
  persisted lockout, concurrent wrong PINs, lock races and PIN change without re-encrypting records:
  `apps/web/src/crypto/__tests__/keyring.test.ts`, `recordCipher.test.ts`, `metadata.test.ts`.

### Encrypted case repository (T4)

- Dexie database `saviatech`, table `cases`. A row exposes only `{ id, v, iv, ct, actualizadoEn }`;
  the code, consent, screenings, band and justification are inside `ct`. Code:
  `apps/web/src/storage/db.ts`, `caseRepository.ts`.
- `list` decrypts only the requested page. `update` compares `actualizadoEn` in a short transaction
  to detect concurrent changes. Code: `caseRepository.ts`.
- A raw IndexedDB dump contains no case code, justification, instrument id or payload field name:
  `apps/web/src/storage/__tests__/caseRepository.test.ts` T4-02.
- The database name, table name, number of cases and update times remain visible in IndexedDB. This
  is an accepted v1 limit recorded in `docs/adr/0009-database-name.md`.

### Lock, auto-lock and quick exit (T5)

- The protected tree renders only while the vault is unlocked and is keyed by the vault epoch, so a
  lock unmounts it. Code: `apps/web/src/ui/Shell.tsx`.
- The PIN is read from the DOM only on submit and cleared in `finally`; it is not copied to React
  state, storage, URLs or logs. Code: `PinSetupScreen.tsx`, `PinUnlockScreen.tsx`, `PinInput.tsx`.
- Auto-lock compares the deadline with the last activity and locks immediately on
  `visibilitychange` and `pagehide`. Code: `apps/web/src/session/autoLock.ts`.
- Quick exit locks first, then shows a neutral screen, replaces the current history entry and changes
  the title. It is synchronous and works from the PIN screens. Code:
  `apps/web/src/session/quickExit.ts`, `apps/web/src/app/createApp.ts`.
- The router is in memory, so routes and case ids never enter the URL. Code:
  `apps/web/src/router/router.ts`.
- `localStorage` is limited to `saviatech.settings` (language and auto-lock timeout). ESLint and
  `apps/web/src/crypto/__tests__/static.test.ts` forbid it elsewhere.
- Tests: `apps/web/src/session/__tests__/autoLock.test.ts`, `quickExit.test.ts`,
  `vaultController.test.ts`; `apps/web/e2e/autoLock.spec.ts`, `quickExit.spec.ts`, `pin.spec.ts`.

### Case flows and content validation (T6)

- Consent is mandatory before a case is created. Answers, alert state, band and justification live
  only in React state registered with `volatileState`, so a lock or quick exit clears them. Code:
  `apps/web/src/flows/`, `apps/web/src/session/volatileState.ts`.
- A changed final band without a written justification is rejected by the repository and disabled in
  the UI. Code: `caseRepository.ts`, `ResultScreen.tsx`.
- Clinical content is validated at startup; invalid content blocks case creation and screening with
  a generic message. Code: `apps/web/src/content/index.ts`,
  `apps/web/src/content/__tests__/content.test.ts`.
- Tests: `apps/web/e2e/flows.spec.ts`.

### CSP, no third-party calls and service worker (T7)

- `apps/web/index.html` contains a CSP meta with `default-src 'self'`, `script-src 'self'`,
  `connect-src 'self'`, `img-src 'self' data:`, `object-src 'none'` and `base-uri 'none'`.
- There are no runtime third-party requests, no CDN, no remote fonts, no analytics, no telemetry and
  no error reporter. The e2e fixture blocks external requests, and `scripts/check-budget.mjs` audits
  the build.
- The service worker is generated by Workbox with `skipWaiting` and `clientsClaim` disabled. The
  precache contains only build files; there is no runtime caching and no `importScripts`. Code:
  `apps/web/vite.config.ts`, `apps/web/src/pwa/swStatus.ts`.
- An update requires an explicit action and is blocked while the vault is unlocked, so a screening
  is not lost. Tests: `apps/web/src/pwa/__tests__/swStatus.test.ts`,
  `apps/web/e2e/settings.spec.ts`.
- The manifest uses a neutral name and geometric icons, with no description, categories, shortcuts
  or screenshots. Code: `apps/web/src/pwa/manifest.ts`,
  `apps/web/src/pwa/__tests__/manifest.test.ts`.
- O5 checks that the case code, PIN and justification are absent from the caches and that
  `localStorage` only contains `saviatech.settings`: `apps/web/e2e/offline.spec.ts`.
- `npm run budget` audits the HTML, precache, manifest and icons. CI runs it after the build.

## What we do not claim

- No independent security audit, penetration test or certification.
- No legal, data-protection or clinical review of the sample content.
- No guarantee that a browser or operating system will not retain screenshots, history or memory.
- No protection against a person who knows or coerces the PIN. There is no duress PIN or second
  factor in v1.
- No protection against an attacker who can edit IndexedDB and reset the local lockout or replay an
  older ciphertext. There is no anti-rollback in v1.
- No recovery if the PIN is forgotten.
- No protection for real data until the open decisions in `docs/threat-model.md` are closed.

## Handling data

- Never send real case data, names, phone numbers or screenshots in a report. Use synthetic examples.
- Never commit secrets, keys or `.env` files with real values.
- Never weaken encryption, the lock behaviour or the content-security policy without a documented
  human decision in `docs/adr/`.
- If a report contains personal data, stop, delete it and tell us in the same thread.

See `docs/threat-model.md` for the full threat model and `docs/adr/README.md` for the decisions.
