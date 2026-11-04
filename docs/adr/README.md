# Architecture decision records

This directory records the decisions that shape SaviaTech. Each ADR is short, dated and owned. The
code is the source of truth; an ADR explains why the code looks the way it does.

## Index

| ADR                                         | Title                                                   | Status   | Date       | Task      |
| ------------------------------------------- | ------------------------------------------------------- | -------- | ---------- | --------- |
| [0000](0000-template.md)                    | Architecture decision record template                   | template | -          | -         |
| [0001](0001-monorepo-and-tooling.md)        | Monorepo layout and baseline tooling                    | accepted | 2026-10-25 | TR-001 T1 |
| [0002](0002-instrument-validation.md)       | Hand-written instrument validation in the rules package | accepted | 2026-10-25 | TR-001 T2 |
| [0003](0003-local-encryption.md)            | Local encryption, wrapped data key and record format    | accepted | 2026-10-26 | TR-001 T3 |
| [0004](0004-language-conventions.md)        | Documentation and comment language                      | accepted | 2026-10-26 | TR-001 T3 |
| [0005](0005-case-storage.md)                | Encrypted case storage with Dexie                       | accepted | 2026-10-27 | TR-001 T4 |
| [0006](0006-ui-shell.md)                    | UI shell, routing and session controls                  | accepted | 2026-10-29 | TR-001 T5 |
| [0007](0007-case-flows.md)                  | Case flows without a state machine                      | accepted | 2026-11-01 | TR-001 T6 |
| [0008](0008-pwa-offline.md)                 | PWA and offline behaviour                               | accepted | 2026-11-02 | TR-001 T7 |
| [0009](0009-database-name.md)               | Database name and visible footprint                     | accepted | 2026-11-03 | TR-001 T8 |
| [0010](0010-demo-instrument-and-content.md) | Demo instrument and clinical content policy             | accepted | 2026-11-03 | TR-001 T8 |
| [0011](0011-v1-scope.md)                    | v1 scope: frontend only, no backend                     | accepted | 2026-11-03 | TR-001 T8 |
| [0012](0012-csp-and-hosting-headers.md)     | CSP in `<meta>` and hosting headers                     | accepted | 2026-11-03 | TR-001 T8 |
| [0013](0013-pin-policy.md)                  | PIN policy and deferred PIN change                      | proposed | 2026-11-03 | TR-001 T8 |

## Status legend

- `template`: the ADR-0000 skeleton. It is not a decision.
- `proposed`: the decision is written down but a named human decision is still missing. The ADR says
  what remains open and who owns it.
- `accepted`: a person confirmed the decision. It can be implemented and cited.
- `superseded`: a newer ADR replaced it. The old file stays for history and names its replacement.
- `deprecated`: the decision is no longer recommended, but no replacement exists yet.

## Rules

1. An accepted ADR is not edited to change its decision. Write a new ADR and add
   `Supersedes: ADR-XXXX` to the new one. Metadata corrections (header, links, typos) are allowed.
2. Every ADR has `Status`, `Date`, `Owners` and, when it comes from a task, `Task:`. Add
   `Supersedes:` when it replaces an earlier decision.
3. One decision per ADR. Keep it short enough to read in a review.
4. Include `Alternatives considered` and say why each alternative was rejected.
5. Link the code, test or document that proves the decision where possible.
6. Update the index in the same change that adds or supersedes an ADR.
7. Security or privacy decisions that affect real data need a human owner. An AI agent can draft a
   `proposed` ADR; it cannot mark it `accepted`.
