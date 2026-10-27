# Crypto module

Local encryption for SaviaTech. The module turns a user PIN into a key hierarchy, keeps the data key
in memory only while the vault is unlocked, and encrypts every persisted record with AES-GCM.

Code comments and JSDoc are in Spanish for the security audit; identifiers and this document are in
English. See `docs/adr/0003-local-encryption.md` for the decision record.

## Key hierarchy

```text
PIN
  -> PBKDF2-HMAC-SHA256 (random 16-byte salt, 600,000 iterations)
  -> KEK (AES-KW 256, non-extractable, wrapKey/unwrapKey)
  -> wraps the DEK (AES-GCM 256, random, stored only wrapped)
  -> the unlocked DEK encrypts each record (AES-GCM, IV + AAD)
```

The PIN is never stored and there is no PIN hash. A wrong PIN is detected when AES-KW fails to unwrap
the DEK. The active DEK is non-extractable and stays in a private keyring field. Callers receive a
bounded session with `encrypt` and `decrypt`; the `CryptoKey` itself is never handed out.

## Parameters

| Parameter          | Value                                                              |
| ------------------ | ------------------------------------------------------------------ |
| KDF                | PBKDF2-HMAC-SHA256                                                 |
| Iterations         | 600,000 target; 600,000 minimum accepted; stored and never lowered |
| Salt               | 16 random bytes per vault                                          |
| KEK                | AES-KW 256, non-extractable                                        |
| DEK                | AES-GCM 256, random, active non-extractable                        |
| Record IV          | 12 random bytes per write                                          |
| Authentication tag | 128 bits                                                           |
| Format version     | 1                                                                  |
| PIN policy         | at least 6 digits                                                  |

The constants live in `constants.ts`. Do not lower the iteration count without a new decision and a
new benchmark.

## Persisted record

```ts
interface EncryptedRecord {
  id: string; // plaintext index and AAD input
  v: number; // format version and AAD input
  iv: Uint8Array; // 12 bytes
  ct: Uint8Array; // ciphertext plus tag
  actualizadoEn: number; // plaintext ordering metadata, not authenticated
}
```

The AAD is `table|id|version`. Table names and ids cannot contain `|`. Decryption requires the expected
id from the index, so moving a ciphertext to another key fails. `actualizadoEn` is not authenticated;
never use it as clinical evidence.

There is no anti-rollback protection in T3. Someone with write access to IndexedDB can replace a record
with an older ciphertext for the same table, id and version; it will decrypt successfully. Detect
rollback with an authenticated server-side sequence or an authenticated local counter in a later task.

## Metadata

One Dexie row stores:

- format version;
- PBKDF2 algorithm, hash, iterations and salt;
- the wrapped DEK;
- failed attempts and `lockedUntil`.

The row contains no PIN, KEK or clear DEK. It does allow an offline PIN attack if an attacker copies
IndexedDB.

Metadata is validated as trusted input: version, algorithms, exact salt size, exact AES-KW wrapped key
size, minimum iteration count, counters and lock time. A malformed or truncated row raises
`CorruptDataError`; it is never treated as an empty vault and cannot silently lock out the user as if
the PIN were wrong.

## Lifecycle

- `load()` reads the persisted state. Call it on startup before trusting `getState()`.
- `initialize(pin)` creates the salt and DEK and leaves the vault `unlocked`.
- `unlock(pin)` derives the KEK and unwraps the DEK. It also verifies the PIN when the vault is already
  unlocked instead of accepting any well-formed PIN.
- `lock()` increments a generation counter and removes the DEK reference. An `unlock()` or
  `changePin()` still in flight cannot publish a key after the lock. Web Crypto cannot force physical
  memory erasure.
- `changePin(currentPin, newPin)` re-wraps the same DEK with a new salt and KEK. Records are not
  re-encrypted. The DEK is temporarily extractable only for the re-wrap and immediately unwrapped as
  non-extractable again. The iteration count of an existing vault is never lowered.
- `withDataKey(operation)` is the only way to use the DEK. It throws `VaultLockedError` when locked and
  passes a `DataKeySession` with `encrypt`, `decrypt` and `extractable`. The session re-checks the lock
  on every call, so retaining it does not bypass `lock()`.

`load`, `initialize`, `unlock` and `changePin` are serialised inside one keyring. A burst of wrong PINs
therefore cannot lose increments through a read-modify-write race. T3 exposes `lock()`; wiring the
inactivity timer and `visibilitychange` handler belongs to the app lifecycle work in T5/T6.

Failed attempts add waits of 0, 0, 5 seconds, 30 seconds and 5 minutes, then stay at 5 minutes. A
successful unlock resets the counter. The wait is persisted, but it is only an in-app brake: someone
who copies IndexedDB can attack the PIN offline.

## Storage integration

`apps/web/src/storage/db.ts` defines the Dexie database and the `cryptoMetadata` table. T4 adds case
tables to the same database. `DexieCryptoMetadataStore` implements the metadata port; the keyring never
imports Dexie.

## Tests

```sh
npm test --workspace @saviatech/web
```

Coverage includes PBKDF2 known vector, non-extractable keys, round trip, unique IVs, tampered
ciphertext and IV, changed AAD, wrong PIN, locked operations with a retained session, PIN change
without re-encryption, persisted lockout, concurrent wrong-PIN attempts, a lock before or during
unlock, distinct salts and wrapped keys, corrupt metadata and recursive static forbidden-API checks.

## Benchmark

Measured on the development machine (Windows, Node.js 24.19.0): approximately **262 ms** for one
PBKDF2-HMAC-SHA256 derivation at 600,000 iterations. A low-end Android measurement is still pending.
The iteration count must not be lowered to make the benchmark pass.

## Known limits

- A six-digit PIN is weak against an offline attack. PBKDF2 raises the cost but does not remove it.
- Forgetting the PIN makes local data unrecoverable; there is no recovery flow in v1.
- `lock()` cannot guarantee physical memory erasure in the browser.
- Two tabs can hold independent unlocked keyrings; cross-tab lock coordination is future work. The
  per-keyring attempt queue does not serialise counters across tabs, so a concurrent multi-tab attack
  could still lose some increments.
- Concurrent `initialize` or `changePin` from two tabs can overwrite the metadata row (last write
  wins), orphaning the other tab's DEK or PIN change. Create the vault and change the PIN in one tab
  until T4/T5 adds cross-tab coordination.
- There is no anti-rollback protection: an attacker with write access can restore an older ciphertext
  for the same table, id and version, and it will decrypt.
- Metadata tampering can cause a denial of service but cannot reveal the plaintext.
- Automatic lock triggers (inactivity and page hide) are wired by the app shell in T5/T6.
- Persistent storage and backup are handled by later tasks.
