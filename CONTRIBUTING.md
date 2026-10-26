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

- One branch per task: `tr-001/t<number>-<slug>`.
- Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Tests live next to the code they cover.
- Keep `packages/rules` free of DOM, storage and network code.

## Local checks

Run these before opening a pull request:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run licenses
```

Never disable a test or lint rule to make a change pass. If a check is wrong, fix the check in its own
change and explain why.

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
