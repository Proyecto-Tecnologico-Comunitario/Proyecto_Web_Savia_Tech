# Security policy

SaviaTech is built for people who may be monitored by an abuser. Please treat security and privacy
reports as sensitive.

## Reporting a vulnerability

Do **not** open a public issue for a vulnerability or for anything that contains personal data.

Email the maintainers privately:

- sergio19855@gmail.com
- jnuryalexandrasuarez@gmail.com

Include the affected version or commit, a description, reproduction steps using synthetic data only,
and the impact you expect. We will acknowledge receipt as soon as possible and coordinate disclosure.

## Scope

In scope:

- encryption at rest and key handling
- PIN lock, auto-lock and quick exit
- data leakage into storage, URLs, logs, analytics or service-worker caches
- offline behaviour and supply-chain issues
- content-security-policy or dependency problems

Out of scope for v1: backend, accounts, synchronisation and DHIS2 (separate repository and later
requirements).

## Current implementation

TR-001 task T3 implements the local key hierarchy and record encryption in `apps/web/src/crypto`.
PBKDF2-HMAC-SHA256 derives a non-extractable AES-KW key, which wraps a random AES-GCM data key. Each
record uses a fresh IV and authenticated AAD. The PIN and the unwrapped data key are never persisted.
The data key is never handed to callers: they get a bounded session that re-checks the lock, and a lock
during an unlock operation prevents that operation from publishing a key.

TR-001 task T4 adds the encrypted case repository in `apps/web/src/storage`. A case row exposes only
`id`, `v`, `iv`, `ct` and `actualizadoEn`; the case code, consent and screenings are inside `ct`.
`list` decrypts only the requested page, and `update` compares `actualizadoEn` outside the IndexedDB
transaction to detect concurrent changes. The database and table names, the number of cases and their
update times remain visible in IndexedDB.

See `apps/web/src/crypto/README.md`, `docs/adr/0003-local-encryption.md` and
`docs/adr/0005-case-storage.md` for parameters, limits and the PIN-change exception. The in-app attempt
delay does not stop an offline attack against a copied IndexedDB.

## Handling data

- Never send real case data, names, phone numbers or screenshots in a report. Use synthetic examples.
- Never commit secrets, keys or `.env` files with real values.
- Never weaken encryption, the lock behaviour or the content-security policy without a documented
  human decision (see `docs/adr/`).

See `docs/threat-model.md` for the current threat model and known limitations.
