# ADR-0011: v1 scope, frontend only and no backend

- Status: accepted
- Date: 2026-11-03
- Owners: Technical Director
- Task: TR-001 T8

## Context

TR-001 defines a vertical slice for a professional working offline on one device. The app must not
send case data to a third party and must not depend on a hosted service. A backend would add
accounts, authentication, authorisation, key management, audit logs, retention, deletion, breach
notification and a much larger threat model. None of that is needed to demonstrate the core flow,
and all of it would need a legal and security review before real data.

The current implementation stores cases only in the local encrypted vault
(`apps/web/src/storage/`), loads content from the build (`content/`), and uses a service worker to
serve the build offline (`apps/web/src/pwa/`). There is no API, no account and no synchronisation.

## Decision

v1 is frontend-only:

1. No backend, accounts, login, roles, synchronisation, DHIS2 integration, push notifications,
   analytics, telemetry or error reporting.
2. Case data never leaves the device. The only network use is the first load and update downloads
   from the static host.
3. There is no cloud backup, no recovery service and no remote deletion.
4. The professional's device is the only copy of the data. Persistent storage is requested, not
   guaranteed.
5. Any future backend, sync or backup feature needs a new ADR, a new threat model, a legal review and
   a key-management design. It cannot be added as an implementation detail.

## Consequences

- The attack surface stays small and the app works without a server.
- There is no backup, no recovery if the PIN is forgotten, no multi-device access, no remote audit
  trail and no usage metrics.
- A lost or wiped device loses the cases. A shared device is effectively a shared account.
- The project cannot measure real-world use or outcomes from the app alone.
- TR-002 is the place to design pausing/resuming a screening and any optional sync or backup, with
  its own threat model.

## Alternatives considered

- **Backend now**: rejected for v1. It adds authentication, authorisation, key management, retention
  and a data-processing agreement before the core flow is validated.
- **Optional encrypted cloud backup**: rejected for v1. Key recovery and multi-device key wrapping
  are unsolved, and a backup would create a second copy of sensitive data.
- **Local export/import file**: deferred. It is a smaller feature than a backend, but it still needs
  a key-management and deletion policy, and it creates a portable copy of the vault.
- **Anonymous usage metrics**: rejected. Even aggregated metrics can leak the existence of the app
  and the case count, and v1 forbids third-party calls.
