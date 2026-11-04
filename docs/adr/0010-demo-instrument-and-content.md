# ADR-0010: Demo instrument and clinical content policy

- Status: accepted
- Date: 2026-11-03
- Owners: Technical Director and Psychosocial Director
- Task: TR-001 T8

## Context

TR-001 needs a complete vertical slice without inventing clinical content. The demo uses a
nine-item instrument in `content/instruments/phq9.sample.json` whose `source` is
`PHQ-9 (abbreviated sample items)` and whose `licenceStatus` is `to-verify`. The file is a sample, not
a validated PHQ-9 reproduction. EPDS was considered and is not used until its licence is verified.

Every clinical, crisis, consent and referral string lives in `content/` with `status: "SAMPLE"` and
must be reviewed by Social Work before any use with real people. The UI shows the sample banner from
`apps/web/src/ui/components/SampleBanner.tsx` and the sample label on the screening screen
(`apps/web/src/i18n/es.json`, `en.json`).

The sample defines:

- nine items with values `0, 1, 2, 3`;
- bands `minimal` 0-4, `mild` 5-9, `moderate` 10-14, `moderately-severe` 15-19 and `severe` 20-27;
- a safety item at zero-based index `8` with `alertWhenAbove: 0`;
- priority referral bands `moderately-severe` and `severe`;
- three sample services with `lastVerified: "SAMPLE-DD-MM-AAAA"`.

## Decision

1. Keep the sample instrument and sample content for the demo only. Do not present them as a
   validated instrument or as medical advice.
2. Keep `status: "SAMPLE"` in every content file and keep the visible sample banner. The validators
   reject any other status (`apps/web/src/content/consent.ts`, `referral.ts`,
   `apps/web/src/content/__tests__/content.test.ts`).
3. Do not use EPDS until its licence is verified. Do not add another instrument without a licence
   review and a Social Work review.
4. Keep the safety item and the `alertWhenAbove: 0` rule. The safety alert appears after the last
   question; showing it earlier is a Social Work decision (ADR-0007).
5. Keep the band thresholds and the priority bands as sample values. They are not clinical guidance
   and need review before a pilot.
6. Keep the explicit "this tool does not diagnose" copy and the professional's final band. The
   result screen and the justification requirement are part of the safety design.
7. Real personal data is out of scope until the Social Work review, the legal review and the minors
   protocol are complete.

## Consequences

- The demo is complete and reproducible without claiming clinical validity.
- A reviewer can see that the content is a sample in the file and on the screen.
- The thresholds, safety rule and referral routes can change without touching the crypto or storage
  layers, because they are data.
- The app cannot be used with real people until the content is reviewed and the licence status is
  resolved.
- Adding a new instrument requires matching `band.<id>` translations and a validation pass.

## Alternatives considered

- **Use EPDS now**: rejected. Its licence is not verified.
- **Reproduce the full PHQ-9 wording**: rejected. The licence status is `to-verify`; the demo uses
  abbreviated sample items and says so.
- **Invent thresholds or safety text**: rejected. Clinical content must not be invented.
- **Remove the sample banner for a cleaner demo**: rejected. It would hide a material limitation.
- **Store the instrument in code instead of `content/`**: rejected. Content must be versioned data
  and reviewable without a code change.
