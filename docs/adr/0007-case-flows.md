# ADR-0007: Case flows without a state machine

- Status: accepted
- Date: 2026-11-01
- Owners: Technical Director
- Task: TR-001 T6

## Context

T6 adds the visible product flow on top of the T4 encrypted repository and the T5 shell: new case,
layered consent, one-question-per-screen screening, safety alert, explainable result with the
professional's final band, case detail and a suggested referral route. The app must stay offline,
must not invent clinical content, and must not keep screening answers anywhere except in memory until
the professional confirms the result.

The repository already forbids XState, Zod, Testing Library and any new dependency without a human
decision. A state machine library would add a dependency and a second source of truth for transitions
that are small and testable on their own.

## Decision

1. **Pure reducers and helpers** live in `apps/web/src/flows/`. They receive the validated instrument
   and the current state and return the next state. Invalid transitions return the same state; they do
   not throw. `newCaseFlow` only records the consent checkbox and the accepted consent;
   `screeningFlow` owns the question index, answers, alert step, result, final band, justification and
   save step. `buildScreeningEntry` converts a completed state into the persisted `ScreeningEntry`.
2. **Content is loaded statically and validated at startup** in `apps/web/src/content/`. The
   instrument uses `validateInstrument`; consent and referral use hand-written validators. Invalid
   content blocks case creation and screening with one translated, generic message.
3. **The case is created when consent is accepted** (`repository.create`). The screening lives only in
   memory and is written once with `repository.update` when the professional confirms the final band.
   A lock in the middle loses the answers. A case may exist with zero screenings.
4. **The safety alert appears after the last question and before the result**, as TR-001 F6 requires.
   The only exit is "Understood". Showing it the moment the safety item is answered is a Social Work
   decision for a later change.
5. **The final band decides referral priority**, together with `safetyAlert`. The band ids that trigger
   the priority route come from `content/referral/`, not from code. Referrals are not persisted.
6. **Navigation is explicit**: list → detail, detail → screening or referral, new case → screening,
   screening saved → detail. The in-memory router keeps case ids out of the URL. Back on the first
   question replaces the screening with the case detail so a half-finished session cannot be rebuilt
   from history.
7. **List and detail are deliberately read-only for clinical content.** The list shows the pseudonymous
   code and update time; the detail shows creation time and a summary of screenings. Answers and
   justification stay in the result screen and the encrypted record.

## Consequences

- The flows are covered by fast Vitest tests without a DOM and by Playwright for the real screens.
- A lock or quick exit loses the screening in progress by design. Pausing and resuming is TR-002.
- v1 has no age, territory, minor status or consent revocation. It cannot detect that a person is a
  minor, so only synthetic data is acceptable before the minors protocol and legal review.
- The referral screen suggests a route but records nothing; service status and reminders are TR-002.
- Adding a new instrument or referral file requires matching `band.<id>` translations and a content
  validation pass.

## Alternatives considered

- **XState or another state machine library**: rejected; it is not pre-approved and the reducers are
  small enough to test directly.
- **Persist every answer as it is entered**: rejected; it would create partial clinical records and a
  larger sensitive surface without a reviewed resume protocol.
- **Store the referral route in the case**: rejected in ADR-0005; v1 only suggests, it does not track.
- **Show the safety alert as soon as the item is answered**: deferred to Social Work review.
