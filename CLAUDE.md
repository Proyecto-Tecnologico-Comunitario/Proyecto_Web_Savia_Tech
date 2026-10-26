@AGENTS.md

## Claude Code specifics

- Start every task in plan mode. Present the plan and wait for approval before editing files.
- Keep this file short. Shared rules belong in AGENTS.md so other agents read them too.
- Use `/clear` between unrelated tasks, and do one TR-001 task per session.
- For crypto work (`apps/web/src/crypto/`), finish the task, then review it separately in plan mode
  ("review for mistakes, do not change code") before moving on.
- Never mark a task done without running `npm run lint`, `npm run typecheck`, `npm test` and
  `npm run build`, and showing the output summary.
