# ADR-0006: UI shell, routing and session controls

- Status: accepted
- Date: 2026-10-29
- Owners: Technical Director
- Task: TR-001 T5

## Context

T1-T4 provide the build, the rules engine, the PIN-derived key hierarchy and encrypted case storage.
T5 adds the shell a professional actually uses: PIN setup and unlock, an in-memory router, automatic
lock, quick exit, Spanish/English text, non-sensitive settings and persistent-storage feedback. The
threat model assumes someone hostile may hold the unlocked phone, so the shell must fail closed and
must not leave protected content mounted while the vault is locked.

No router or i18n runtime dependency is allowed. `AGENTS.md` already pre-approves Playwright for
end-to-end tests.

## Decision

### Routing (D3)

- The router keeps its stack in memory. The URL never contains a route, case id, query or hash.
- Every lock path resets navigation: automatic lock and the lock button call `reset()`, while quick
  exit calls `showNeutral()`, which also discards the stack.
- The Android/browser Back button leaves the app instead of moving through screens. Screens that need
  to go back render an explicit "Back" button. T6 may revisit native Back with a new ADR.

### Settings storage (D2)

- `settings/settingsStore.ts` is the only module allowed to read or write `localStorage`. It stores one
  JSON value under `saviatech.settings` with only `locale` and `autoLockMs`.
- These values are not sensitive and must be available before unlock so the PIN screen already uses
  the chosen language. Invalid JSON, wrong types or an unsupported timeout fall back per field without
  throwing. A missing or failing storage keeps the values in memory.
- ESLint and the static test forbid `localStorage`/`sessionStorage` everywhere else.

### Session and lock order

- `vaultController` publishes `loading`, `uninitialized`, `locked`, `unlocked` or `failed`. It only
  publishes `unlocked` when the keyring confirms that state after the operation.
- `lock()` always runs in this order: lock the keyring, clear the volatile-state registry, then publish
  `locked`/`uninitialized` with a new epoch. The protected tree is keyed by the epoch, so every lock
  unmounts it.
- Automatic lock uses a deadline, not only a timer: it stores the last activity time and compares
  `now - lastActivityAt` when the timer fires or the tab becomes visible. Hiding the page or `pagehide`
  locks immediately. The timeout options are 1, 2 and 5 minutes; the default is 2 minutes. There is no
  "off" option.
- Quick exit is synchronous and runs four independent steps: lock, show neutral, replace the current
  history entry, set the neutral title. A failure in one step does not skip the following steps; the
  lock is the step that is never omitted.

### Quick exit on PIN screens (D4)

- The same quick-exit button is visible on PIN setup and unlock. Those screens already reveal the app
  name, and there is no protected content to clear. A reviewer may remove it with a later decision.

### Document title (D7)

- Locked and unlocked screens use `VITE_APP_NAME` (default `SaviaTech`).
- The neutral screen uses the localized "Notas"/"Notes" title and shows no app name, logo, language
  selector or quick-exit button.

### Styles and development CSP

- The three stylesheets are linked from `apps/web/index.html` in cascade order (`tokens`, `base`,
  `components`) instead of imported from `main.tsx`. Vite serves imported CSS as inline `<style>`
  elements in development, and the production CSP (`default-src 'self'`, without
  `style-src 'unsafe-inline'`) blocks them, leaving the dev UI unstyled. External links are served as
  CSS in development and extracted to one asset by the production build; the CSP stays unchanged.

### End-to-end tests (D1)

- Playwright runs against `vite preview` after `vite build`, not the development server. This exercises
  the production CSP and catches inline-style regressions.
- `npm run e2e` exists from T5. The offline PWA flow remains T7. CI has a separate `e2e` job that
  installs Chromium with system dependencies.

### Change PIN (D6, open)

- The UI does not expose `keyring.changePin` in T5. If someone knows the current PIN, the professional
  cannot change it from the app. This is an open human decision for a later task.

## Consequences

- No case data can appear in the URL or survive a lock in a mounted component.
- The URL is constant, so browser history and screenshots of the address bar reveal nothing.
- Native Back leaves the app; users need the on-screen Back control.
- Settings are readable and modifiable by anyone with local access. They protect nothing and are
  limited to language and timeout.
- A lock during unlock/setup is silent and never publishes `unlocked`.
- Browser screenshots in the app switcher and retained history entries remain best-effort limits.
- A forgotten PIN still makes local data unrecoverable; there is no recovery flow.
- Development and preview load the same stylesheet order without relaxing the production CSP.

## Alternatives considered

- URL or hash routing: rejected because route names and ids could leak through history.
- A Dexie table for settings: rejected for T5 because it adds a migration and has the same exposure as
  `localStorage`.
- `jsdom` plus Testing Library: not pre-approved, and it would not validate the real CSP.
- Testing only the development server: rejected because Vite injects inline styles that production
  does not use.
- Allowing `style-src 'unsafe-inline'` in development only: rejected because development would stop
  exercising the production CSP and could hide regressions.
