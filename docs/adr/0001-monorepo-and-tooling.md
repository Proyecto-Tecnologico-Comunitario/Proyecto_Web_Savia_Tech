# ADR-0001: Monorepo layout and baseline tooling

- Status: accepted
- Date: 2026-10-25
- Owners: Technical Director
- Task: TR-001 T1

## Context

TR-001 needs a pure TypeScript rules engine and a React PWA that share types, with reproducible
checks on Node 20 LTS. The product must stay offline-first, with no runtime third-party calls. The
backend is not part of v1 and will live in a separate repository.

## Decision

- npm workspaces with `apps/web` and `packages/rules`; no backend or API package in this repository.
- TypeScript strict, ES modules, bundled by Vite 7. JSX is transformed by Vite's built-in esbuild
  using the `react-jsx` setting in `tsconfig.base.json`; React 19 needs no extra build plugin at
  this stage.
- Vitest 3 for unit tests. Vitest 4 and 5 pull Vite 8, whose direct `lightningcss` dependency is
  MPL-2.0; that is outside the permissive-only dependency rule.
- ESLint 10 flat config plus Prettier, run as one `lint` script.
- `@vitejs/plugin-react` and `eslint-plugin-react-hooks` are deferred. Both pull `@babel/core` and
  therefore `caniuse-lite` (CC-BY-4.0), which is not a permissive code licence. Fast Refresh and hook
  linting are revisited before the UI work in T5, with an explicit dependency decision.
- A dependency-licence check implemented as a zero-dependency Node script, so the check has no
  licence surface of its own.
- GitHub Actions runs `npm ci`, lint, typecheck, test, build and the licence check on Node 20.
- Per-component licences: MIT for `packages/rules` and tooling, GPL-3.0-or-later for `apps/web`,
  CC-BY-4.0 for `content` and `docs`.
- The content-security policy lives in `apps/web/index.html` as required by the spec.

## Consequences

- A single lockfile and one CI job for the whole frontend.
- The rules package must remain free of DOM, storage and network code so it can be reused by a future
  backend or other clients.
- Playwright, the service worker, the web manifest and the bundle budget are deferred to TR-001 T7.
- Dependency licence failures block CI. Adding a dependency requires a licence review.
- Fast Refresh and React hooks linting are not enabled yet, so contributors must review hook
  dependencies manually and accept full page reloads during development.

## Alternatives considered

- Separate repositories for the web app and rules: rejected because v1 needs shared types and one
  reviewable change set.
- pnpm or Yarn: rejected to keep the pre-approved npm toolchain and a single familiar lockfile.
- A third-party licence checker: rejected to avoid an extra dependency for a small allowlist check.
- TypeScript 7: rejected for now because `typescript-eslint` supports only up to TypeScript 6.1.
- Vitest 4/5 and Vite 8: rejected because they add an MPL-2.0 dependency (`lightningcss`) and a
  second Vite copy, which breaks typechecking across the workspace.
- `@vitejs/plugin-react` and `eslint-plugin-react-hooks`: deferred because their Babel dependency
  chain includes CC-BY-4.0 data (`caniuse-lite`), and because Vite already compiles JSX here.
