# ADR-0013: PIN policy and deferred PIN change

- Status: proposed
- Date: 2026-11-03
- Owners: Technical Director
- Task: TR-001 T8

## Context

The vault is unlocked with a PIN that derives the key-encryption key
(`apps/web/src/crypto/keyring.ts`, `kdf.ts`, `constants.ts`). The current policy is:

- minimum length 6 digits (`PIN_MIN_LENGTH = 6`);
- no rejection of trivial PINs such as `000000` or `123456`;
- no alphanumeric passphrase in v1;
- PBKDF2-HMAC-SHA256 with 600,000 iterations and a random 16-byte salt;
- persisted waits after wrong attempts: 0, 0, 5 seconds, 30 seconds and 5 minutes;
- the keyring supports `changePin`, which re-wraps the data key without re-encrypting cases;
- the UI does not expose a PIN change (D6).

A six-digit PIN has a small space. If an attacker copies IndexedDB, the in-app wait does not apply and
the PIN can be attacked offline. A longer passphrase would raise the cost, but it adds keyboard and
usability problems on low-end phones and needs a recovery policy.

## Decision

For v1:

1. Keep the six-digit minimum. It is the shortest PIN the current UX can enforce without a new
   keyboard and confirmation flow.
2. Do not add a denylist of trivial PINs. It would reject a few obvious values without changing the
   offline cost and would create a false sense of strength.
3. Do not add an alphanumeric passphrase in v1. It is a TR-002 feature with its own UX, recovery and
   testing work.
4. Do not expose a PIN-change screen in v1. The keyring already supports it, but the UI, error states
   and tests are not part of this slice. This is D6 and remains open.
5. If someone knows the current PIN, the professional must stop using that vault and follow the
   project's incident protocol. There is no in-app rotation in v1. Do not claim that changing the PIN
   would protect data that the person may already have seen.
6. A future passphrase or PIN-change feature needs a new ADR and must keep the same wrapped-key
   design: changing the PIN re-wraps the data key and does not re-encrypt case rows.

## Consequences

- The demo is simple and usable on a phone keypad.
- A copied vault can be attacked offline against a six-digit space. The 600,000 PBKDF2 iterations
  raise the cost but do not remove the risk.
- There is no way to rotate a compromised PIN from the UI. The only safe action is to stop using the
  vault and follow the protocol.
- A future passphrase or PIN change can reuse the existing `changePin` path, but it needs UI, error
  handling, accessibility and tests.
- This ADR is `proposed` until the Technical Director confirms D6 and the passphrase route.

## Alternatives considered

- **Four-digit PIN**: rejected. It is too small for an offline attack.
- **Six digits with a denylist**: deferred. It does not materially change the offline cost and adds
  a maintenance list.
- **Alphanumeric passphrase now**: deferred to TR-002. It needs a different keyboard, confirmation
  and recovery flow.
- **Expose PIN change now**: deferred. The keyring path exists, but the UI and tests are not in
  scope for T8, and a half-tested rotation could give false assurance.
- **Recovery code or cloud escrow**: rejected for v1. It would create a second key path and a new
  sensitive asset.
