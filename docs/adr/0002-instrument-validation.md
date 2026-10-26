# ADR-0002: Hand-written instrument validation in the rules package

- Status: accepted
- Date: 2026-10-25
- Owners: Technical Director
- Task: TR-001 T2

## Context

Instrument content is loaded from versioned JSON files in `content/`. A malformed file could produce a
wrong score, an uncovered score, or a safety alert that can never fire. TypeScript types disappear at
runtime, so the JSON must be validated before use. The dependency rules allow only pre-approved,
permissive packages, and a schema library was not approved.

## Decision

- Implement validation by hand in `packages/rules`, without a schema dependency. Each rule is small,
  pure and testable.
- Return a discriminated `ValidationResult<T>` with `ok`, `value` or `errors`; never throw for invalid
  content. Each error carries a `path` such as `languages.en.items` or `safetyItem.alertWhenAbove`.
- Enforce at runtime:
  - mandatory non-empty text fields and `status: "SAMPLE"`;
  - Spanish and English, with the same number of items in every language;
  - one option label per option value;
  - integer, strictly increasing option values;
  - ordered bands with unique ids, no gaps or overlaps, covering the full possible score range;
  - a safety item index inside the item list and a threshold that is an option value below the maximum.
- Validate answers separately: one answer per item, integer and included in `optionValues`. Missing,
  `null`, `undefined` and out-of-range values are errors.
- Keep the scoring API pure: `scoreAnswers`, `bandForScore`, `hasSafetyAlert` and
  `evaluateScreening` receive a validated instrument. The safety alert uses a strict `>` comparison
  against the threshold.
- Keep validator messages in English. User-facing translations belong to the web app i18n files.

## Consequences

- No new dependency and no licence risk.
- Developers must update the validator when the instrument contract changes.
- The sample content file and its loading wire-up remain for T6/T9; this task only guarantees that any
  file can be checked before use.
- Error paths are stable enough for content authors but are not yet a public versioned API.
- Thresholds and band boundaries are technical validation only; clinical values still need Social Work
  review.

## Alternatives considered

- Zod or Valibot: rejected because they are not pre-approved dependencies and add a runtime bundle.
- JSON Schema plus Ajv: rejected for complexity and dependency footprint.
- TypeScript types alone: rejected because JSON is untrusted at runtime.
