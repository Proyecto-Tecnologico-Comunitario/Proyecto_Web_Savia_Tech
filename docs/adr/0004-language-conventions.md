# ADR-0004: Documentation and comment language

- Status: accepted
- Date: 2026-10-26
- Owners: Technical Director
- Task: TR-001 T3

## Context

The project is audited by Spanish-speaking reviewers and by external agents. Repository documents,
identifiers and error messages are easier to share and search in English, while security comments and
JSDoc are easier to audit line by line in Spanish. The existing specification in `docs/specs/` is
already written in Spanish and must remain readable.

## Decision

- Repository documentation is written in English: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`,
  `AGENTS.md`, ADRs, threat model and new implementation notes.
- Identifiers, types, error messages, test names and Conventional Commit types are in English.
- Code comments and JSDoc are in Spanish. Security-relevant logic is commented line by line so a
  reviewer can follow each decision without translating.
- Commit descriptions are in Spanish, for example `feat(crypto): agrega derivación de la clave`.
- User-facing text lives only in the i18n files and may be Spanish or English according to the active
  locale.
- The existing Spanish requirements in `docs/specs/` stay in Spanish. New requirement files may be
  written in Spanish when they are intended for the same clinical and audit review.

## Consequences

- Reviewers get English navigation and Spanish security reasoning.
- Contributors must keep comments close to the code they explain and update them when behaviour
  changes.
- A comment that contradicts the code is a defect. Tests and code are the source of truth.
- Mixed-language sources are expected; the rule is explicit rather than implicit.

## Alternatives considered

- All documentation and comments in English: rejected because the current audit and the clinical
  reviewers work in Spanish.
- All documentation and comments in Spanish: rejected because the public repository and the
  international open-source review use English.
- Spanish identifiers: rejected because the existing rules package, errors and APIs are in English.
