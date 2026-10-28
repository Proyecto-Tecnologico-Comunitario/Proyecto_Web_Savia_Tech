# TR-001: Vertical slice — offline, encrypted screening on a PWA

- **Status:** in progress (T1–T4 implemented; T5 next)
- **Owner:** Technical Director
- **Target:** working demo and public repository by 2026-11-03 (UNICEF deadline is 2026-11-04, 11:59 p.m. CET)
- **Reference mock-up:** `docs/design/savia_demo.html` (flow, copy and layout only; it is vanilla JS with in-memory data, do not reuse its code)

## 1. Goal

On a low-end Android phone with no network, a frontline worker can:

1. unlock the app with a PIN,
2. create a pseudonymous case,
3. record consent,
4. complete one screening instrument,
5. see an explainable risk level (and a safety alert when relevant),
6. confirm or override the level with a justification,
7. see the local referral pathway,

and everything is stored encrypted on the device. The whole flow can be shown in under 2 minutes.

## 2. Context

- Funder requirements that shape this work: a public open-source repository, a working prototype
  that has produced initial data, safety-by-design (privacy, consent, user risk), and a 2-minute
  video showing the real team and the real product working.
- Most sensitive threat scenario: someone hostile to the woman inspects the phone.
- v1 has no backend. Sync, a public aggregated-metrics dashboard and DHIS2 export come in TR-002.

## 3. In scope

- Installable PWA that works fully offline after the first load.
- Screens: lock/PIN, case list, new case + consent, screening, safety alert, result, referral pathway,
  neutral screen (quick exit), settings (language, auto-lock time).
- One instrument loaded from a data file (sample PHQ-9-style items).
- Rules engine in `packages/rules` with unit tests.
- Encrypted local persistence.
- Spanish and English UI.
- Repository hygiene (see T1 and T8).

## 4. Out of scope (do not build)

Backend or server, accounts or login, synchronisation, DHIS2, public metrics, NLP or any AI,
supervisor dashboard, analytics or tracking, push notifications, real personal data.

## 5. Technical constraints

- Node 20+ LTS, npm workspaces (`apps/web`, `packages/rules`).
- TypeScript strict, Vite, React, vite-plugin-pwa (Workbox), Dexie (IndexedDB), Web Crypto,
  Vitest, Playwright, ESLint, Prettier.
- Everything bundled. No runtime calls to third parties.
- Content-Security-Policy set in `index.html` (static hosting may not allow headers):
  `default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'`.
  Avoid inline styles and scripts. If a relaxation is unavoidable, record it in an ADR.
- Performance target: initial JavaScript at or below 250 KB gzipped; usable on a throttled low-end profile.
- The app name and icons are build-time configuration (`VITE_APP_NAME`, default `SaviaTech`), so a
  deployment can use a neutral name. The web manifest cannot change after installation.
- Request persistent storage with `navigator.storage.persist()` and show a warning if it is denied.

## 6. Design of the sensitive parts

### 6.1 Encryption at rest

- On first run the user sets a PIN of at least 6 digits.
- A random 256-bit AES-GCM **data key** is generated once.
- A **key-encryption key** is derived from the PIN with PBKDF2-SHA-256, a random 16-byte salt and at
  least 600,000 iterations (make it a config constant and benchmark it on a low-end phone).
- The data key is stored only in wrapped form (encrypted with the key-encryption key). A correct PIN
  is verified by successfully unwrapping it. The PIN itself is never stored.
- Each case record is stored as `{ id, v, iv, ct, actualizadoEn }`. `id`, `v`, `iv`, `ct` and
  `actualizadoEn` are the only fields in clear. `createdAt` lives inside the encrypted payload. The IV
  is random, 12 bytes, unique per write. The record id and format version are used as additional
  authenticated data (AAD), together with the table name.
- Only `id` (primary key) and `actualizadoEn` are indexed. Everything else is inside the ciphertext.
  `actualizadoEn` is ordering metadata, not clinical evidence. See ADR-0005 for the correction to this
  section (T4 decision D1).
- Decrypted payload shape (TypeScript types live in `packages/rules` or `apps/web/src/model`):

```json
{
  "code": "K7QM-3XPA",
  "synthetic": true,
  "consent": { "textVersion": "sample-1", "timestamp": "2026-10-28T14:03:00Z" },
  "screenings": [{
    "instrumentId": "phq9-sample", "instrumentVersion": "0.1",
    "answers": [0,1,2,1,0,1,0,0,0],
    "score": 5, "computedBand": "mild", "finalBand": "mild",
    "justification": null, "safetyAlert": false,
    "timestamp": "2026-10-28T14:10:00Z"
  }]
}
```

- Known limitation to document in `docs/threat-model.md`: a PIN-derived key can be attacked offline if
  someone copies the device storage. Mitigations: a longer passphrase option later, a high
  iteration count, and clear user guidance.

### 6.2 Lock and quick exit

- Auto-lock after 2 minutes of inactivity (configurable) and whenever the page becomes hidden.
  Locking removes the data key and decrypted state from memory.
- Failed PIN attempts add an increasing delay (UI-level; document that it does not stop offline attacks).
- Quick exit (visible on every unlocked screen): one tap clears in-progress case state, locks, and
  replaces the current history entry with a neutral screen (a plain "Notes" page with no content), so
  Back does not return to sensitive screens. Best effort; document browser limits.
- Notifications are out of scope in v1. When added later they must never contain sensitive text.

### 6.3 Content files

Instrument file (`content/instruments/phq9.sample.json`), validated by a schema in `packages/rules`:

```json
{
  "id": "phq9-sample", "version": "0.1", "status": "SAMPLE",
  "source": "PHQ-9 (abbreviated sample items)", "licenceStatus": "to-verify",
  "languages": {
    "es": { "title": "...", "items": ["...", "..."], "options": ["...", "..."] },
    "en": { "title": "...", "items": ["...", "..."], "options": ["...", "..."] }
  },
  "optionValues": [0, 1, 2, 3],
  "bands": [
    { "id": "minimal", "min": 0, "max": 4 }, { "id": "mild", "min": 5, "max": 9 },
    { "id": "moderate", "min": 10, "max": 14 }, { "id": "moderately-severe", "min": 15, "max": 19 },
    { "id": "severe", "min": 20, "max": 27 }
  ],
  "safetyItem": { "index": 8, "alertWhenAbove": 0 }
}
```

Also create `content/consent/consent.sample.json` (es/en text, version) and
`content/referral/referral.sample.json` (name, type, priority, phone placeholder, `lastVerified`
placeholder, all marked SAMPLE). Do not invent real phone numbers, hotlines or institutions.

## 7. Functional requirements

| ID | Requirement |
|---|---|
| F1 | After the first online load, the whole flow works with the network disabled. |
| F2 | PIN setup and unlock as in 6.1 and 6.2. Minimum 6 digits. |
| F3 | Create a case with a random, human-readable pseudonymous code (no name or identifier required). |
| F4 | Consent screen from data file (es/en). The flow cannot continue without it. Stores text version and timestamp. |
| F5 | Screening from the instrument file. Shows progress, allows going back, cannot finish with a missing item, shows instrument metadata and the SAMPLE label. |
| F6 | Result: score, band and the answers that weighed most (value 2 or higher). If the safety item is above its threshold, show the safety alert (sample text) before the result. Professional can keep or change the band; a change requires a written justification. Store computed band, final band and justification. |
| F7 | Referral pathway from data file. High, moderately-severe, severe or any safety alert shows the priority route first. Each contact shows its last-verified placeholder. Marked SAMPLE. |
| F8 | All case data is stored encrypted (6.1). A test proves raw IndexedDB values contain no plaintext. |
| F9 | Quick exit and auto-lock as in 6.2. |
| F10 | Spanish and English, switchable at any time. |
| F11 | Repository hygiene: LICENSE files per component, README with demo steps, CONTRIBUTING, SECURITY.md, CODE_OF_CONDUCT, `docs/threat-model.md` (initial), ADRs, CI. |

## 8. Acceptance criteria (all must be checkable)

- `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and `npm run licenses` pass in CI.
- Rules tests cover each band boundary (0, 4, 5, 9, 10, 14, 15, 19, 20, 27), missing answers, invalid
  values and the safety alert.
- Crypto tests: round trip; wrong PIN fails; tampered ciphertext fails; changed AAD fails; IVs are unique.
- Storage test: after saving a case, no field value or the case code appears in plaintext in the raw
  IndexedDB dump.
- Playwright: the full flow passes with the browser context offline. Quick exit leaves no sensitive text in the DOM.
- The app passes an installability check, and the bundle budget in section 5 is met.
- Manual check on a real low-end Android phone in airplane mode (record the model and result in the README).

## 9. Tasks (one branch and one review each)

| # | Task | Done when |
|---|---|---|
| T1 | Scaffold repo: workspaces, tooling, CI, licences, docs skeleton, copy the mock-up into `docs/design/` | CI is green on an empty app |
| T2 | `packages/rules`: types, instrument schema validation, scoring, bands, safety alert | Rules tests in section 8 pass |
| T3 | `apps/web/src/crypto`: key derivation, wrapping, record encryption | Crypto tests pass |
| T4 | Storage layer: Dexie plus encrypted repository (create, list, update case) | Storage tests pass |
| T5 | UI shell: routing, lock screen, auto-lock, quick exit, i18n, settings | Lock and quick-exit e2e pass |
| T6 | Flows: case, consent, screening, safety alert, result, referral | Full flow works online |
| T7 | PWA and offline: service worker, manifest, offline e2e, performance budget | Offline e2e passes, budget met |
| T8 | Docs: README with demo steps, `docs/threat-model.md`, SECURITY.md, ADRs | A new person can run the demo from the README |
| T9 | Synthetic demo data and demo script (dev-only seed, all records `synthetic: true`) | The 2-minute script runs end to end |

## 10. Demo script (for the 2-minute video)

1. Phone in airplane mode. Open the installed app, enter the PIN.
2. New case: pseudonymous code appears, consent is recorded.
3. Complete the screening with synthetic answers, including one that triggers the safety alert.
4. Show the explainable result and change the band with a justification.
5. Show the referral pathway with the priority route.
6. Tap quick exit, show the neutral screen, then lock.

## 11. Decisions and defaults

These do not block the work; use the default and record it in an ADR if a person has not decided.

| Decision | Default | Owner |
|---|---|---|
| Licence per component | MIT (`packages/rules`), GPL-3.0-or-later (`apps/web`), CC-BY-4.0 (`content`, `docs`) | Technical Director |
| Demo instrument | Sample PHQ-9-style items, status SAMPLE. EPDS is not used until its licence is verified | Psychosocial Director |
| Crisis and consent texts, referral routes | SAMPLE placeholders | Psychosocial Director (Social Work) |
| PIN policy | 6 digits minimum | Technical Director |
| Neutral app name for demos | `SaviaTech` | Both |

## 12. Next requirement

TR-002: backend (open source, self-hostable), event-log synchronisation, public dashboard of aggregated
and anonymised usage metrics with minimum-count thresholds, and DHIS2 aggregate export in a test environment.
