# Threat model (initial)

- Status: draft, updated in TR-001 tasks T3 and T4. Needs review in T8.
- System: offline-first PWA for pseudonymous psychosocial screening by frontline professionals.
- Data: pseudonymous case code, consent record, screening answers, scores, professional decision and
  referral pathway. No names or direct identifiers are required in v1.

## Assets

1. Screening answers, scores and the professional's notes.
2. Consent records.
3. The data key that decrypts case records.
4. The PIN and its derived key-encryption key.
5. Integrity of the instrument, thresholds and referral content.
6. The wrapped data key and crypto metadata needed to unlock the vault.

## Actors and threats

| Threat                                                     | Impact                         | Current or planned mitigation                                                                                                                                                                                        |
| ---------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Someone hostile to the woman inspects an unlocked phone    | Reads or copies sensitive data | PIN lock, auto-lock after inactivity, lock on page hide, quick exit to a neutral screen, no sensitive text in notifications (T5)                                                                                     |
| Attacker copies device storage and attacks the PIN offline | Recovers the data key          | PBKDF2-SHA-256 with 600,000 iterations and a random 16-byte salt, AES-KW wrapped data key, six-digit minimum PIN, longer passphrase later; residual risk documented                                                  |
| Sensitive data leaks through the platform                  | Coercion, retaliation          | Only `id`, `v`, `iv`, `ct`, `actualizadoEn` and non-secret crypto metadata are stored in clear; the payload is encrypted; no logging, analytics, URLs, cookies or cache of case data                                 |
| Tampering with stored records                              | Wrong clinical decision        | AES-GCM authentication with table, id and version as AAD; a changed ciphertext, table, id or version fails authentication. Older ciphertext for the same context can still be replayed; anti-rollback is future work |
| Tampering with lockout metadata                            | Bypass the in-app wait         | The wait is a local brake only; an attacker who can edit IndexedDB can also reset it. It does not protect against offline PIN cracking                                                                               |
| Malicious or compromised dependency                        | Code execution or exfiltration | Minimal dependency set, permissive licences only, licence check in CI, no runtime third-party calls, CSP, scoped ESLint rules for the crypto module                                                                  |
| Lost or stolen device with no backup                       | Data loss                      | Request persistent storage; warn when denied; no cloud backup in v1                                                                                                                                                  |
| Shoulder surfing during the 2-minute demo                  | Exposure of a synthetic case   | Synthetic data only; quick exit                                                                                                                                                                                      |

## Implemented encryption controls (T3)

- PIN-derived KEK: PBKDF2-HMAC-SHA256, SHA-256, 256-bit output, random 16-byte salt and 600,000
  iterations stored in metadata.
- KEK: AES-KW 256, non-extractable, usages `wrapKey` and `unwrapKey`.
- DEK: AES-GCM 256, random, stored only wrapped, non-extractable while unlocked.
- Record encryption: AES-GCM with a fresh 12-byte IV, 128-bit tag and `table|id|version` AAD.
- Metadata: one Dexie row with KDF parameters, wrapped DEK, failed attempts and `lockedUntil`. No PIN,
  KEK or clear DEK.
- Failed attempts: persisted waits of 0, 0, 5 seconds, 30 seconds and 5 minutes. Success resets them.
  Operations are serialised per keyring so a double submit cannot lose increments.
- Lock races: `lock()` increments a generation counter. An `unlock` or `changePin` still in flight
  cannot publish a key after the lock.
- The DEK is never passed to callers. `withDataKey` gives a bounded session whose `encrypt` and
  `decrypt` re-check the lock state.
- Metadata validation: version, algorithms, exact salt and wrapped-key sizes, minimum iterations and
  counters. Corrupt metadata fails as corrupt data, not as a wrong PIN.
- Code controls: no console output, no web storage and no external crypto imports inside
  `apps/web/src/crypto`; PBKDF2 and browser crypto only.
- Tests: wrong PIN, tampered ciphertext, changed AAD, unique IVs, non-extractable keys, persisted
  lockout, concurrent wrong PINs, lock during unlock and PIN change without re-encrypting records.

## Implemented storage controls (T4)

- Dexie database `saviatech`: version 2 keeps `cryptoMetadata` and adds `cases` with primary key `id`
  and index `actualizadoEn`. The version 1 to 2 upgrade preserves the metadata row.
- One case is one encrypted record. The row is exactly `{ id, v, iv, ct, actualizadoEn }`.
- `id` is a random UUID generated with Web Crypto. `actualizadoEn` is ordering metadata. `createdAt`,
  the pseudonymous code, consent and screenings live inside `ct`.
- `create` and `update` validate the payload with `parseCasePayload`; a changed final band without a
  written justification is rejected.
- `list` decrypts only the requested page. A row that fails authentication or validation is reported in
  `unreadableIds` without aborting the rest of the page.
- `update` uses optimistic comparison: it decrypts and encrypts outside the IndexedDB transaction, then
  compares `actualizadoEn` in a short read-write transaction. No Web Crypto call runs inside it.
- `changePin` re-wraps the DEK only; case rows are not re-encrypted.
- `requestPersistentStorage` and `estimateStorage` wrap `navigator.storage`. The UI warning is T5/T6.
- Tests prove that a raw IndexedDB dump contains no case code, justification, instrument id or payload
  field name, and that moved or altered ciphertext fails authentication.

## Known limitations

- A PIN-derived key can be brute-forced offline if an attacker copies storage. The iteration count
  raises the cost but does not eliminate it. A longer passphrase option and a recovery policy are
  future work.
- The in-app lockout is not a defense against an attacker who copies or edits IndexedDB. It only slows
  repeated attempts on the device.
- Locking removes keys and decrypted state from memory on a best-effort basis. Browser memory
  management cannot be fully controlled.
- Two browser tabs can hold independent unlocked keyrings; cross-tab lock, attempt-count and case
  write coordination is still open. The repository detects concurrent updates inside one database, but
  two tabs can still race. Concurrent `initialize` or `changePin` from two tabs can overwrite the
  metadata row, so setup and PIN changes must be single-tab for now.
- The database name `saviatech` and the table name `cases` are visible in IndexedDB. T8 decides whether
  the database name becomes build configuration (`VITE_DB_NAME`) or stays documented as a limit (D3).
- `actualizadoEn` is plaintext and unauthenticated. It is ordering metadata, not clinical evidence. The
  number of cases and their recency are therefore visible, even though their content is encrypted.
- There is no anti-rollback protection. An attacker who can write IndexedDB can restore an older
  ciphertext for the same table, id and version, and it will decrypt. A later task needs an
  authenticated sequence or a server-side check if rollback matters for clinical decisions.
- Forgetting the PIN makes local data unrecoverable in v1.
- CSS `:visited`-style history leaks and browser autofill are outside our control; the app must not put
  case data in URLs or form fields that persist.
- Quick exit and history replacement are best effort and vary by browser.
- T4 covers the raw IndexedDB case rows and the record cipher. The low-end Android performance
  measurement for listing and decrypting pages is still pending.

## Out of scope for v1

Backend, accounts, synchronisation, DHIS2, push notifications, analytics and multi-device access.

## Review

This document is a placeholder until the T8 review. Do not treat it as a completed security review.
