# ADR-0009: Database name and visible footprint

- Status: accepted
- Date: 2026-11-03
- Owners: Technical Director
- Task: TR-001 T8

## Context

The encrypted case repository in `apps/web/src/storage/db.ts` uses the IndexedDB database
`saviatech` and the table `cases`. The `actualizadoEn` index is also visible. A person who inspects
the phone can see these names even though every case payload is encrypted.

T4 left the question open (D3): either make the database name build configuration
(`VITE_DB_NAME`) or document the name as a limit. Renaming a database after a vault exists would
orphan the existing metadata and case rows, because the app would open a new empty database and the
old wrapped key would no longer be reachable. The same applies to a per-install random name without a
migration.

## Decision

Keep `saviatech` and `cases` in v1 and document the visible footprint as an accepted limit. Do not add
`VITE_DB_NAME` in this task. Any future rename must happen before the first real deployment and must
either migrate existing rows or explicitly accept that existing vaults become unreachable.

The decision is recorded here and in `docs/threat-model.md` (T-22). It does not change the
cryptographic design or the data format.

## Consequences

- A local inspector can infer the app's purpose from the database and table names.
- Renaming later is a migration problem, not a cosmetic change.
- Even with a neutral name, the number of cases, their update times, their approximate size and the
  installed app's name and icon remain visible. A neutral database name would not hide the app.
- The app keeps the simple, tested database lifecycle from T4. No new configuration or migration code
  is introduced before the demo.
- If a deployment requires a neutral name, it must be decided before any real vault is created.

## Alternatives considered

- **`VITE_DB_NAME` build setting now**: rejected for v1. It is a small code change, but it adds a
  configuration surface and a migration trap without removing the other visible signals.
- **Per-install random database name**: rejected. It hides the name but adds a mapping that must be
  stored somewhere, plus a migration path for existing vaults, for little gain.
- **Generic name such as `app`**: rejected as cosmetic. It reduces the signal but does not remove the
  case count, recency or installed app name, and it still needs the same migration decision.
- **Delete or rename the database at every start**: rejected. It would destroy the vault.
