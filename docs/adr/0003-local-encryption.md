# ADR-0003: Local encryption, wrapped data key and record format

- Status: accepted
- Date: 2026-10-26
- Owners: Technical Director
- Task: TR-001 T3

## Context

Case data must stay illegible if someone with physical access copies IndexedDB from an unlocked phone.
The app is offline-first and v1 has no backend, so the PIN is the only user secret. The implementation
must use the native Web Crypto API only, must not invent primitives, and must keep the data key out of
logs, web storage and React state.

T3 also needs a persisted counter of failed PIN attempts so a reload does not reset the in-app wait.
The storage task (T4) will add the case tables; T3 only needs one metadata record.

## Decision

### Key hierarchy

- Derive a 256-bit KEK from the PIN with PBKDF2-HMAC-SHA256, a random 16-byte salt and 600,000
  iterations. The parameters are stored in metadata so they can be raised later without breaking old
  vaults. The compatibility floor is a separate constant (`PBKDF2_MIN_ITERATIONS`), so raising the
  target for new vaults does not reject existing vaults that meet the old floor.
- Import the KEK as a non-extractable AES-KW `CryptoKey` with usages `wrapKey` and `unwrapKey`.
- Generate one random 256-bit AES-GCM DEK when the vault is initialized. The DEK is extractable only
  while it is wrapped. The active DEK is unwrapped again as non-extractable with usages `encrypt` and
  `decrypt`.
- The PIN is never stored and there is no PIN hash. A wrong PIN is detected because AES-KW
  unwrapping fails. The failure is mapped to `IncorrectPinError`.
- The active DEK lives in a private field of the keyring closure. It is never placed in React state,
  Zustand, `localStorage`, `sessionStorage`, cookies, URLs or logs.
- Callers never receive the `CryptoKey`. `withDataKey` exposes a bounded `DataKeySession` with
  `encrypt`, `decrypt` and `extractable`; every call re-checks that the same DEK is still active. A
  retained session therefore fails after `lock()`.

### Record encryption

- Encrypt every record with AES-GCM, a random 12-byte IV and a 128-bit authentication tag.
- Bind each record to `table|id|version` as AAD. Table names and ids cannot contain the separator.
- Persist `{ id, v, iv, ct, actualizadoEn }`. `id`, `v`, `iv`, `ct` and `actualizadoEn` are not
  sensitive. The payload and all clinical content stay inside `ct`.
- Decryption requires the expected id from the index. The function also checks `record.id`, so changing
  the plaintext id cannot silently move a record to another key.
- `actualizadoEn` is not part of the AAD. It is ordering metadata and can be tampered with without
  breaking decryption; it must never be treated as clinical evidence. This also means the ciphertext
  can be rolled back for the same id, table and version.

### Metadata and lock behaviour

- Persist a single metadata row: format version, KDF parameters, wrapped DEK, failed attempts and
  `lockedUntil`.
- Store the row in Dexie through a `CryptoMetadataStore` port. T3 adds only the `cryptoMetadata` table;
  T4 will add case tables.
- Failed attempts add waits of 0, 0, 5 seconds, 30 seconds and 5 minutes, then stay at 5 minutes.
  A successful unlock resets the counter.
- `load`, `initialize`, `unlock` and `changePin` are serialised inside one keyring, so concurrent wrong
  PIN submissions cannot lose counter increments through a read-modify-write race. `lock` increments a
  generation counter; an operation still in flight after `lock` cannot publish a key.
- Metadata is validated at the storage boundary: exact salt and wrapped-key lengths, supported
  algorithms and version, non-negative counters and at least the minimum PBKDF2 iterations. A corrupt
  row raises `CorruptDataError` instead of being treated as an empty vault or a wrong PIN.
- `initialize` leaves the vault unlocked because the user just created the PIN. `load` is required on
  startup to discover whether the vault exists. `lock` removes the DEK reference.
- T3 exposes `lock`; the inactivity timer and `visibilitychange` handler are wired by the app shell in
  T5/T6.
- `changePin` re-wraps the existing DEK. AES-KW requires an extractable key to wrap it, so the DEK is
  unwrapped temporarily as extractable, wrapped with the new KEK and immediately unwrapped again as
  non-extractable. It is never persisted in extractable form. Records are not re-encrypted.

### Errors and tests

- Domain errors are explicit: invalid PIN, incorrect PIN, locked vault, corrupt data, unsupported
  version, already initialized, not initialized and too many attempts.
- Error messages are English and generic. They never include the PIN, keys, IVs, plaintext or
  ciphertext.
- Unit tests use Node's WebCrypto and `fake-indexeddb`. ESLint blocks console output, `Math.random`,
  web storage and external crypto imports inside `apps/web/src/crypto`.

## Consequences

- No runtime crypto dependency and no third-party call.
- A copied IndexedDB can be attacked offline against a six-digit PIN. The iteration count raises the
  cost but does not remove the risk. A longer passphrase and a recovery policy need future work.
- The in-app wait is only a UI-level brake. An attacker who copies storage can ignore it.
- `lock()` removes the JavaScript reference to the DEK but cannot force the browser to wipe memory.
- Multi-tab locking and attempt counting are not coordinated in T3. Two tabs can hold independent
  unlocked keyrings, and a concurrent multi-tab attack can still lose some attempt increments.
- Concurrent `initialize` or `changePin` from two tabs can overwrite the single metadata row and orphan
  the other tab's DEK or PIN change. Vault creation and PIN changes must be single-tab until a later
  task adds a transactional or cross-tab guard.
- There is no anti-rollback protection. An attacker with write access can restore an older ciphertext
  for the same `table|id|version` and it will decrypt. A later task needs an authenticated sequence or a
  server-side check if rollback matters for clinical decisions.
- `initialize` and `changePin` need a persisted metadata write. A failed write leaves the previous
  vault intact and the keyring locked.
- T4 must use the indexed id as the expected AAD id and must not put sensitive values in indexed
  fields.

## Alternatives considered

- Encrypt the whole IndexedDB with one key: rejected because the record format needs per-record IVs and
  AAD, and because a single stolen blob is harder to rotate.
- Keep the DEK extractable: rejected because the app could export it and a bug could leak it.
- Re-encrypt all records when the PIN changes: rejected because it is slower, risks partial migration
  and the task explicitly asks for re-wrapping only.
- Store a PIN hash for verification: rejected because it adds a second offline target and is
  unnecessary when unwrapping already fails.
- Use a third-party crypto library: rejected by the project rules and the T3 requirement.
