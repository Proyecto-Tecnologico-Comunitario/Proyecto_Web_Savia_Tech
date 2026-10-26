# Threat model (initial)

- Status: draft, created in TR-001 task T1. Needs review in T8.
- System: offline-first PWA for pseudonymous psychosocial screening by frontline professionals.
- Data: pseudonymous case code, consent record, screening answers, scores, professional decision and
  referral pathway. No names or direct identifiers are required in v1.

## Assets

1. Screening answers, scores and the professional's notes.
2. Consent records.
3. The data key that decrypts case records.
4. The PIN and its derived key-encryption key.
5. Integrity of the instrument, thresholds and referral content.

## Actors and threats

| Threat                                                     | Impact                         | Current or planned mitigation                                                                                                         |
| ---------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Someone hostile to the woman inspects an unlocked phone    | Reads or copies sensitive data | PIN lock, auto-lock after inactivity, lock on page hide, quick exit to a neutral screen, no sensitive text in notifications           |
| Attacker copies device storage and attacks the PIN offline | Recovers the data key          | PBKDF2-SHA-256 with high iteration count and random salt, AES-GCM wrapped data key, longer passphrase later; residual risk documented |
| Sensitive data leaks through the platform                  | Coercion, retaliation          | Only `id` and `createdAt` in clear; everything else encrypted; no logging, analytics, URLs, cookies or cache of case data             |
| Tampering with stored records                              | Wrong clinical decision        | AES-GCM authentication with the record id as AAD; tampered ciphertext fails                                                           |
| Malicious or compromised dependency                        | Code execution or exfiltration | Minimal dependency set, permissive licences only, licence check in CI, no runtime third-party calls, CSP                              |
| Lost or stolen device with no backup                       | Data loss                      | Request persistent storage; warn when denied; no cloud backup in v1                                                                   |
| Shoulder surfing during the 2-minute demo                  | Exposure of a synthetic case   | Synthetic data only; quick exit                                                                                                       |

## Known limitations

- A PIN-derived key can be brute-forced offline if an attacker copies storage. The iteration count
  raises the cost but does not eliminate it. A longer passphrase option is future work.
- Locking removes keys and decrypted state from memory on a best-effort basis. Browser memory
  management cannot be fully controlled.
- CSS `:visited`-style history leaks and browser autofill are outside our control; the app must not put
  case data in URLs or form fields that persist.
- Quick exit and history replacement are best effort and vary by browser.

## Out of scope for v1

Backend, accounts, synchronisation, DHIS2, push notifications, analytics and multi-device access.

## Review

This document is a placeholder until the T8 review. Do not treat it as a completed security review.
