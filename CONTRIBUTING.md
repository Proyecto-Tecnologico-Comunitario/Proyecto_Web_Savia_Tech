# Contributing to SaviaTech

Thank you for helping. This project handles sensitive psychosocial data, so safety and privacy take
priority over speed.

## Before you start

1. Read `AGENTS.md`, `SECURITY.md` and the relevant spec in `docs/specs/`.
2. Open an issue or comment on the task before large changes. Do not expand scope.
3. Use synthetic data only. Never paste real names, phone numbers, case notes or screenshots into
   issues, commits or tests.
4. Clinical content (instruments, thresholds, crisis text, referral routes, consent) needs Social
   Work review. Do not invent it. Mark placeholders `SAMPLE`.

## Workflow

- One branch per task: `<type>/t<number>-<slug>`, for example `feat/t3-cifrado`.
- Conventional Commits with an English type and a Spanish description: `feat(crypto): agrega ...`,
  `test(crypto): cubre ...`, `docs: actualiza ...`.
- Tests live next to the code they cover.
- Keep `packages/rules` free of DOM, storage and network code.
- Repository documentation, identifiers, error messages and test names are in English. Code comments
  and JSDoc are in Spanish. UI text belongs in the i18n files.

## Local checks

Run these before opening a pull request:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run budget
npm run licenses
```

Install the Playwright browser once with `npm run e2e:install`, then run `npm run e2e` when the change
touches the UI, lock, offline behaviour or the service worker.

Never disable a test or lint rule to make a change pass. If a check is wrong, fix the check in its own
change and explain why.

## Documentation changes

When a change touches a security or privacy control, update the documentation in the same pull
request:

- `docs/threat-model.md`: the control, the file or test that proves it, and the residual risk. If the
  control has no automated test, say so.
- `SECURITY.md`: the current implementation and any new limit.
- `docs/adr/`: a new ADR for a new decision, or a new ADR with `Supersedes:` for a changed decision.
  Never edit an accepted ADR's decision. Update `docs/adr/README.md` in the same change.
- `README.md`: commands, demo steps, measurements or verification records that changed.
- `docs/specs/TR-001-vertical-slice.md`: the task status when a task starts or finishes.

Repository documentation is in English. The Spanish specification in `docs/specs/` stays in Spanish.
There is no automated `docs:check` script yet; check links, ADR statuses, the index and the absence of
placeholder text by hand.

## Dependencies

Only OSI-approved permissive licences are allowed. The pre-approved list is in `AGENTS.md`. Ask
before adding any other dependency and explain the need. No proprietary SDKs, hosted services or
runtime third-party calls.

## Pull requests

- Explain what changed, what you were unsure about and what needs a human decision.
- Report the real result of the checks. Do not claim a feature works without a test or a manual check.
- Accessibility is required: labels, visible focus, 44 px touch targets, WCAG 2.1 AA contrast and both
  colour schemes.

## Licences

By contributing you agree that your contribution is licensed under the licence of the component you
modify: MIT for `packages/rules/` and tooling, GPL-3.0-or-later for `apps/web/`, CC-BY-4.0 for
`content/` and `docs/`.
